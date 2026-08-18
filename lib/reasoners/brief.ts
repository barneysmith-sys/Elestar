/**
 * Deterministic interview brief — the no-API-key path for
 * `buildInterviewBrief`.
 *
 * The brief is the payoff of the whole product, so it is also where
 * fabrication would do the most damage: a recruiter who skips a round on the
 * strength of a made-up claim finds out the expensive way. Every line this
 * produces therefore carries a provenance:
 *
 *   KNOWN    — stated in the record itself
 *   INFERRED — derived by a named rule from something known
 *   UNKNOWN  — absent from the record, and said so rather than filled in
 *
 * The "safe to skip" cap from src/interviewBrief.ts applies here too: never
 * more than half a loop, because past that recruiters stop trusting the brief.
 */

import type { Depth, InterviewBrief, ParsedProcess } from "../../src/types";

export type Provenance = "known" | "inferred" | "unknown";

export interface BriefFact {
  claim: string;
  provenance: Provenance;
  /** Why this is knowable — the record field or rule it came from. */
  basis: string;
}

export interface AnnotatedBrief extends InterviewBrief {
  facts: BriefFact[];
  /** 0..1, derived from how much of the brief rests on assessed evidence. */
  confidence: number;
  confidenceBasis: string;
}

const DEPTH_LABEL: Record<Depth, string> = {
  assessed: "a full round was dedicated to it",
  probed: "a substantial part of a round covered it",
  mentioned: "it only came up in conversation",
};

/** Round types whose signal never transfers from another company's process. */
const NEVER_SKIP_BY_DEFAULT = [
  "Your own team's collaboration signal — no external process can measure fit with your people.",
  "Anything your role requires that this process never tested.",
];

export function buildInterviewBriefDeterministic(args: {
  record: ParsedProcess;
  roleDescription: string;
  hiringLoop?: string[];
}): AnnotatedBrief {
  const { record, roleDescription, hiringLoop } = args;
  const facts: BriefFact[] = [];

  // ---- already assessed: KNOWN -------------------------------------------
  // Straight off the record. `mentioned` is excluded on purpose — it is not
  // evidence of assessment, and listing it as such is how a brief starts
  // lying.
  const assessed = record.competencies.filter((c) => c.depth === "assessed" || c.depth === "probed");
  const alreadyAssessed = assessed.map((c) => {
    const round = record.rounds.find((r) => r.index === c.roundIndex);
    const format = round ? round.label : "format not recorded";
    facts.push({
      claim: `${c.name} was ${c.depth}`,
      provenance: "known",
      basis: `Record competency "${c.name}", depth ${c.depth}${round ? `, round ${round.index} (${round.label})` : ""}.`,
    });
    return { competency: c.name, depth: c.depth, format };
  });

  // ---- mentioned-only: UNKNOWN -------------------------------------------
  for (const c of record.competencies.filter((x) => x.depth === "mentioned")) {
    facts.push({
      claim: `${c.name} is unverified`,
      provenance: "unknown",
      basis: `Depth is "mentioned" — ${DEPTH_LABEL.mentioned}. Treat as untested.`,
    });
  }

  // ---- safe to skip: INFERRED --------------------------------------------
  // The rule: a round of yours is redundant only if a round of theirs
  // assessed the same competency at full depth. `probed` is not enough.
  const fullyAssessed = record.competencies.filter((c) => c.depth === "assessed");
  const loop = hiringLoop ?? [];
  const candidateSkips: InterviewBrief["safeToSkip"] = [];

  for (const yourRound of loop) {
    const overlap = fullyAssessed.find((c) => roundCovers(yourRound, c.name));
    if (!overlap) continue;
    const theirRound = record.rounds.find((r) => r.index === overlap.roundIndex);
    candidateSkips.push({
      round: yourRound,
      redundantWith: theirRound ? `${theirRound.label} (${overlap.name}, assessed)` : `${overlap.name} (assessed)`,
    });
    facts.push({
      claim: `Your "${yourRound}" is likely redundant`,
      provenance: "inferred",
      basis: `Rule: a competency assessed at full depth elsewhere does not need retesting. "${overlap.name}" was assessed${theirRound ? ` in ${theirRound.label}` : ""}.`,
    });
  }

  // Same cap as the model path: never more than half a loop.
  const cap = Math.floor((loop.length || 5) / 2);
  const safeToSkip = candidateSkips.slice(0, cap);
  if (candidateSkips.length > cap) {
    facts.push({
      claim: `${candidateSkips.length - cap} further skip suggestion(s) withheld`,
      provenance: "inferred",
      basis: `Rule: never recommend skipping more than half a loop (cap ${cap} of ${loop.length || 5}).`,
    });
  }

  // ---- probe instead: INFERRED from gaps ---------------------------------
  const probeInstead: string[] = [];
  const gapCompetencies = requestedCompetencies(roleDescription).filter(
    (want) => !record.competencies.some((c) => roundCovers(want, c.name)),
  );
  for (const gap of gapCompetencies.slice(0, 4)) {
    probeInstead.push(`${gap} — nothing in this record tests it.`);
    facts.push({
      claim: `Probe ${gap}`,
      provenance: "inferred",
      basis: `Requested in the role description, absent from the record's competencies.`,
    });
  }
  for (const c of record.competencies.filter((x) => x.depth === "probed").slice(0, 2)) {
    probeInstead.push(`${c.name} — probed but never assessed at depth; confirm it yourself.`);
  }
  if (probeInstead.length === 0) {
    probeInstead.push(
      "Anything specific to your codebase or domain — this record covers process signal, not your stack.",
    );
  }

  // ---- never skip --------------------------------------------------------
  const neverSkip = [...NEVER_SKIP_BY_DEFAULT];
  if (record.evidence === "self_attested") {
    neverSkip.unshift("Verification of the loop itself — this record is self-attested and uncorroborated.");
    facts.push({
      claim: "Evidence is self-attested",
      provenance: "known",
      basis: `Record evidence field is "self_attested" — no third party has confirmed this loop.`,
    });
  }

  // ---- outcome context: KNOWN or UNKNOWN --------------------------------
  let outcomeContext: string;
  if (record.outcome === "unstated") {
    outcomeContext =
      `The record does not say why this process ended. That is a genuine gap, not a negative signal — ` +
      `Elestar does not infer a performance outcome from silence. If it matters to your decision, ask directly.`;
    facts.push({
      claim: "Why the process ended",
      provenance: "unknown",
      basis: `Outcome field is "unstated". Never inferred.`,
    });
  } else {
    outcomeContext = `${OUTCOME_CONTEXT[record.outcome]} This is the candidate's own stated reason, not an inference.`;
    facts.push({
      claim: `Process ended: ${record.outcome.replace(/_/g, " ")}`,
      provenance: "known",
      basis: `Outcome field is "${record.outcome}", taken from the candidate's description.`,
    });
  }

  if (record.roundsTotal !== null && record.rounds.length < record.roundsTotal) {
    facts.push({
      claim: `${record.roundsTotal - record.rounds.length} round(s) are counted but unlabelled`,
      provenance: "unknown",
      basis: `roundsTotal (${record.roundsTotal}) exceeds the ${record.rounds.length} rounds we could name. Labels were not invented.`,
    });
  }

  // ---- confidence -------------------------------------------------------
  const known = facts.filter((f) => f.provenance === "known").length;
  const unknown = facts.filter((f) => f.provenance === "unknown").length;
  const confidence = round2(
    clamp01(record.roundsConfidence * 0.6 + (facts.length ? known / facts.length : 0) * 0.4),
  );

  return {
    alreadyAssessed,
    safeToSkip,
    probeInstead,
    neverSkip,
    outcomeContext,
    facts,
    confidence,
    confidenceBasis:
      `Round-count confidence ${record.roundsConfidence.toFixed(2)} (60%) combined with the share of this brief ` +
      `resting on stated fact — ${known} known, ${facts.filter((f) => f.provenance === "inferred").length} inferred, ` +
      `${unknown} unknown (40%).`,
  };
}

const OUTCOME_CONTEXT: Record<Exclude<ParsedProcess["outcome"], "unstated">, string> = {
  req_closed: "The requisition closed. This says nothing about the candidate.",
  internal_candidate: "The role went to an internal candidate. This says nothing about the candidate.",
  comp_mismatch: "The process ended on compensation, not capability. Check your band before investing rounds.",
  competitive_loss: "Another candidate was chosen. A close loss at this depth is still strong signal.",
  candidate_withdrew: "The candidate withdrew. Worth understanding what changed for them.",
  performance: "The candidate stated the process ended on performance. Probe the specific area yourself.",
};

// ---------------------------------------------------------------------------

/** Loose containment test used to line up round names with competency names. */
function roundCovers(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const [x, y] = [norm(a), norm(b)];
  if (x.includes(y) || y.includes(x)) return true;
  const xs = new Set(x.split(/\s+/).filter((w) => w.length > 3));
  return y.split(/\s+/).some((w) => w.length > 3 && xs.has(w));
}

/** Competencies the role description explicitly asks for. */
function requestedCompetencies(roleDescription: string): string[] {
  const table: [RegExp, string][] = [
    [/\bsystem design|architecture|distributed\b/i, "System design"],
    [/\balgorithms?|data structures?|coding\b/i, "Algorithms"],
    [/\bfrontend|react|css\b/i, "Frontend engineering"],
    [/\bbackend|api|services?\b/i, "Backend engineering"],
    [/\bdata|sql|warehouse|pipeline\b/i, "Data engineering"],
    [/\bml|machine learning|model\b/i, "Applied ML"],
    [/\bsecurity|auth\w*\b/i, "Security reasoning"],
    [/\binfra\w*|kubernetes|platform|devops\b/i, "Infrastructure operations"],
    [/\blead\w*|mentor\w*|manage\w*\b/i, "Engineering leadership"],
    [/\bproduct\b/i, "Product judgement"],
    [/\bon[- ]call|incident|reliability\b/i, "Operational debugging"],
  ];
  return table.filter(([re]) => re.test(roleDescription)).map(([, name]) => name);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
