/**
 * Deterministic record matching — the no-API-key path for `matchRecords`.
 *
 * This one reuses the product's real weighting constants rather than
 * inventing its own: `DEPTH_WEIGHT` and `recencyMultiplier` are imported from
 * src/matchRecords.ts, so a deterministic match and a model match are scored
 * against the same definition of what evidence is worth.
 *
 * The scoring is fully explainable, which matters more here than in the other
 * reasoners: rule 4 of the agent layer is that anything a recruiter sees must
 * be explainable to the candidate it describes. Every component below is a
 * number a candidate could check.
 */

import { DEPTH_WEIGHT, recencyMultiplier } from "../../src/matchRecords";
import type { MatchResult, ParsedProcess } from "../../src/types";

/** Component weights. They sum to 1 so `fitScore` is a real percentage. */
const WEIGHTS = {
  competencyOverlap: 0.45,
  processSimilarity: 0.25,
  seniorityAlignment: 0.2,
  recency: 0.1,
} as const;

const SENIORITY_TERMS: [RegExp, number][] = [
  [/\b(intern|junior|jr|entry[- ]level|new grad)\b/, 1],
  [/\b(mid[- ]level|mid|associate)\b/, 2],
  [/\b(senior|sr)\b/, 3],
  [/\b(staff|lead|principal)\b/, 4],
  [/\b(director|head of|vp|vice president|cto)\b/, 5],
];

const ROUND_TERMS: [RegExp, string][] = [
  [/\b(recruiter|phone) screen|screening\b/, "screen"],
  [/\b(technical|coding|algorithms?)\b/, "technical"],
  [/\b(system design|architecture)\b/, "system_design"],
  [/\bcase|portfolio\b/, "case"],
  [/\btake[- ]?home|work sample\b/, "take_home"],
  [/\bpanel|onsite\b/, "panel"],
  [/\bfinal|exec|founder\b/, "final"],
];

const SECTOR_TERMS: [RegExp, string][] = [
  [/\bfintech|payments?|banking|lending\b/, "fintech"],
  [/\bhealth ?tech|healthcare|clinical\b/, "healthtech"],
  [/\b(ai|ml|machine learning|llm)\b/, "ai_ml"],
  [/\bmarketplace\b/, "marketplace"],
  [/\bsecurity|infosec\b/, "security"],
  [/\bdev ?tools?|infra\w*|platform\b/, "devtools"],
  [/\be[- ]?commerce|retail\b/, "ecommerce"],
  [/\bcrypto|web3\b/, "crypto"],
  [/\bsaas|b2b\b/, "saas"],
  [/\bdata\b/, "data"],
];

/** Words too common to count as a competency signal on their own. */
const STOPWORDS = new Set([
  "a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with", "who", "that",
  "has", "have", "is", "was", "were", "we", "our", "you", "your", "role", "engineer",
  "engineering", "candidate", "candidates", "experience", "years", "year", "looking",
  "someone", "strong", "good", "great", "team", "work", "working", "company", "series",
]);

export interface DeterministicMatchResult {
  results: MatchResult[];
  trace: string[];
}

export function matchRecordsDeterministic(args: {
  roleDescription: string;
  candidates: { recordId: string; record: ParsedProcess; monthsAgo: number }[];
  limit?: number;
}): DeterministicMatchResult {
  const query = args.roleDescription.toLowerCase();
  const trace: string[] = [];

  const wantedCompetencies = tokenize(query);
  const wantedRounds = new Set(
    ROUND_TERMS.filter(([re]) => re.test(query)).map(([, type]) => type),
  );
  const wantedSector = SECTOR_TERMS.find(([re]) => re.test(query))?.[1] ?? null;
  const wantedSeniority = SENIORITY_TERMS.find(([re]) => re.test(query))?.[1] ?? null;

  trace.push(
    `Query terms: ${wantedCompetencies.size} competency token(s)` +
      `${wantedRounds.size ? `, round types ${[...wantedRounds].join("/")}` : ""}` +
      `${wantedSector ? `, sector ${wantedSector}` : ""}` +
      `${wantedSeniority ? `, seniority level ${wantedSeniority}/5` : ""}.`,
  );
  trace.push(
    `Scoring ${args.candidates.length} record(s) on competency overlap (${WEIGHTS.competencyOverlap}), ` +
      `process similarity (${WEIGHTS.processSimilarity}), seniority alignment (${WEIGHTS.seniorityAlignment}), ` +
      `recency (${WEIGHTS.recency}).`,
  );

  const results: MatchResult[] = args.candidates.map(({ recordId, record, monthsAgo }) => {
    // --- competency overlap, weighted by how deeply each was tested --------
    const matched: string[] = [];
    let earned = 0;
    let available = 0;
    for (const c of record.competencies) {
      const weight = DEPTH_WEIGHT[c.depth];
      available += weight;
      if (competencyMatches(c.name, wantedCompetencies)) {
        earned += weight;
        matched.push(`${c.name} (${c.depth})`);
      }
    }
    const competencyOverlap = available > 0 ? clamp01(earned / available) : 0;

    // --- process similarity ------------------------------------------------
    const recordRounds = new Set(record.rounds.map((r) => r.type));
    let processSimilarity: number;
    if (wantedRounds.size === 0) {
      // No round types asked for: fall back to loop depth as a proxy, since a
      // deeper loop is more informative regardless of shape.
      processSimilarity = clamp01(record.roundsCleared / 5);
    } else {
      const shared = [...wantedRounds].filter((t) => recordRounds.has(t as never)).length;
      processSimilarity = clamp01(shared / wantedRounds.size);
    }

    // --- seniority alignment ----------------------------------------------
    // Rounds cleared is the only seniority signal an anonymised record has.
    const recordSeniority = record.roundsCleared >= 5 ? 4 : record.roundsCleared >= 3 ? 3 : 2;
    const seniorityAlignment =
      wantedSeniority === null ? 0.6 : clamp01(1 - Math.abs(recordSeniority - wantedSeniority) / 4);

    // --- recency -----------------------------------------------------------
    const recency = recencyMultiplier(monthsAgo);

    const fitScore = Math.round(
      100 *
        (competencyOverlap * WEIGHTS.competencyOverlap +
          processSimilarity * WEIGHTS.processSimilarity +
          seniorityAlignment * WEIGHTS.seniorityAlignment +
          recency * WEIGHTS.recency),
    );

    // --- gaps: what this record does NOT tell you -------------------------
    // The schema requires at least one, deliberately: a rationale with no gap
    // is a sales pitch, not intelligence.
    const gaps = buildGaps({ record, wantedRounds, recordRounds, wantedSector, monthsAgo });

    return {
      recordId,
      fitScore,
      components: { competencyOverlap, processSimilarity, seniorityAlignment, recency },
      matched,
      gaps,
      rationale: buildRationale({ matched, competencyOverlap, processSimilarity, recency, monthsAgo }),
    };
  });

  results.sort((a, b) => b.fitScore - a.fitScore);
  const limited = results.slice(0, Math.min(args.limit ?? 20, 20));
  trace.push(`Returning ${limited.length} record(s), highest fit ${limited[0]?.fitScore ?? 0}/100.`);

  return { results: limited, trace };
}

// ---------------------------------------------------------------------------

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .split(/[^a-z0-9+#]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function competencyMatches(name: string, wanted: Set<string>): boolean {
  const tokens = tokenize(name.toLowerCase());
  for (const t of tokens) {
    if (wanted.has(t)) return true;
    // Cheap stem match so "designing"/"design" and "systems"/"system" agree.
    for (const w of wanted) {
      if (w.length > 4 && (t.startsWith(w.slice(0, -1)) || w.startsWith(t.slice(0, -1)))) return true;
    }
  }
  return false;
}

function buildGaps(args: {
  record: ParsedProcess;
  wantedRounds: Set<string>;
  recordRounds: Set<string>;
  wantedSector: string | null;
  monthsAgo: number;
}): string[] {
  const { record, wantedRounds, recordRounds, wantedSector, monthsAgo } = args;
  const gaps: string[] = [];

  for (const t of wantedRounds) {
    if (!recordRounds.has(t as never)) {
      gaps.push(`No evidence for a ${t.replace("_", " ")} round — this process never tested it.`);
    }
  }

  const mentionedOnly = record.competencies.filter((c) => c.depth === "mentioned");
  if (mentionedOnly.length > 0) {
    gaps.push(
      `${mentionedOnly.map((c) => c.name).join(", ")} came up in conversation but was never assessed.`,
    );
  }

  if (wantedSector && record.employerProfile.sector !== wantedSector) {
    gaps.push(
      record.employerProfile.sector
        ? `Sector differs: this process was ${record.employerProfile.sector}, not ${wantedSector}.`
        : `Sector is unstated on this record, so domain transfer is unverified.`,
    );
  }

  if (record.outcome === "unstated") {
    gaps.push("The process outcome was never stated, so why it ended is unknown.");
  }

  if (monthsAgo >= 12) {
    gaps.push(`Evidence is ${monthsAgo} months old and discounted to ${recencyMultiplier(monthsAgo)}× accordingly.`);
  }

  if (record.evidence === "self_attested") {
    gaps.push("Self-attested only — no third-party corroboration of this loop yet.");
  }

  return gaps.length > 0 ? gaps : ["No gaps detected by the deterministic scorer, which is itself a limit of it."];
}

function buildRationale(args: {
  matched: string[];
  competencyOverlap: number;
  processSimilarity: number;
  recency: number;
  monthsAgo: number;
}): string {
  const { matched, competencyOverlap, processSimilarity, recency, monthsAgo } = args;
  if (matched.length === 0) {
    return (
      `No competency overlap with the query. Ranked on process shape (${pct(processSimilarity)}) ` +
      `and recency (${monthsAgo}mo, ${recency}×) only.`
    );
  }
  return (
    `${matched.length} overlapping competenc${matched.length === 1 ? "y" : "ies"} weighted by tested depth ` +
    `(${pct(competencyOverlap)} of this record's evidence), process shape ${pct(processSimilarity)}, ` +
    `evidence ${monthsAgo}mo old at ${recency}×.`
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
