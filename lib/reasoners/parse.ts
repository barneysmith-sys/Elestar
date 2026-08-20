/**
 * Deterministic process parser — the no-API-key path for `parseProcess`.
 *
 * This is not a mock. It genuinely reads the candidate's text and derives
 * rounds, competencies, employer profile and outcome from it with rules, and
 * it obeys the same constraints prompts/parse.ts puts on the model:
 *
 *   - never invent a round; a vague quantifier emits the LOWER bound and
 *     drops roundsConfidence below 0.6
 *   - a take-home and the call reviewing it are ONE round
 *   - scheduling and rejection calls are not rounds
 *   - `outcome` stays "unstated" unless the candidate actually said why;
 *     "performance" is never inferred from silence or from a rejection
 *   - clarifying questions instead of guesses
 *
 * It is weaker than the model at prose it has no pattern for, and it says so:
 * every result it produces is tagged `deterministic` and surfaces in the UI
 * under "DEMO MODE · SIMULATED REASONING". What it is NOT is random — the
 * same input always produces the same record, which is what makes the demo
 * repeatable.
 */

import { computeTier } from "../../src/parseProcess";
import type { Competency, Outcome, ParsedProcess, Round, RoundType } from "../../src/types";

interface RoundPattern {
  type: RoundType;
  label: string;
  /** Matched against the lowercased description. */
  re: RegExp;
  /** Competencies this round type is evidence of having been tested. */
  competencies: string[];
}

/**
 * Ordered so that the emitted `rounds` array reflects the usual loop
 * sequence when the candidate didn't make ordering explicit. Ordering within
 * the text wins where we can detect it (see `orderRounds`).
 */
const ROUND_PATTERNS: RoundPattern[] = [
  {
    type: "screen",
    label: "Recruiter screen",
    re: /\b(recruiter screen|recruiter call|recruiter chat|phone screen|initial screen|screening call|hr screen|intro call)\b/,
    competencies: ["Background review", "Compensation alignment"],
  },
  {
    type: "screen",
    label: "Hiring manager conversation",
    re: /\b(hiring manager|hm (?:call|chat|screen|interview)|manager screen)\b/,
    competencies: ["Role motivation", "Scope of ownership"],
  },
  {
    type: "take_home",
    label: "Take-home exercise",
    re: /\b(take[- ]?home|work sample|offline exercise|coding challenge sent|async exercise)\b/,
    competencies: ["Applied problem solving", "Code quality"],
  },
  {
    type: "technical",
    label: "Technical interview",
    re: /\b(technical (?:interview|round|screen)|coding (?:interview|round|exercise)|live coding|pair programming|algorithms? round|data structures)\b/,
    competencies: ["Data structures", "Algorithms", "Language fluency"],
  },
  {
    type: "system_design",
    label: "System design",
    re: /\b(system design|architecture (?:interview|round|discussion)|design (?:interview|round)|scalability (?:interview|round))\b/,
    competencies: ["Distributed systems", "Scalability", "Trade-off reasoning"],
  },
  {
    type: "case",
    label: "Case study",
    re: /\b(case study|case (?:interview|round)|business case|product case|portfolio review)\b/,
    competencies: ["Structured analysis", "Domain judgement"],
  },
  {
    type: "panel",
    label: "Panel interview",
    re: /\b(panel|onsite|on[- ]site|loop day|virtual onsite)\b/,
    competencies: ["Cross-functional collaboration", "Communication"],
  },
  {
    type: "final",
    label: "Final round",
    re: /\b(final (?:round|panel|interview|stage)|exec (?:interview|round)|executive (?:interview|round)|founder (?:interview|chat|round)|vp (?:interview|round)|bar raiser)\b/,
    competencies: ["Architecture depth", "Engineering leadership"],
  },
  {
    type: "other",
    label: "Behavioral interview",
    re: /\b(behaviou?ral|values (?:interview|round)|culture (?:fit|interview|round)|leadership principles)\b/,
    competencies: ["Collaboration", "Ownership"],
  },
];

/** Phrases that mean "an unknown number of rounds" — lower bound + low confidence. */
const VAGUE_QUANTIFIER =
  /\b(a few|several|multiple|a couple(?: of)?|some|various|numerous|handful of|bunch of|many)\s+(\w+\s+){0,2}(interviews?|rounds?|calls?|conversations?|stages?)\b/;

/** Things that look like rounds but aren't, per the parser contract. */
const NON_ROUNDS = /\b(scheduling call|rejection call|offer call|debrief|reference check|background check)\b/g;

const SECTORS: [RegExp, string][] = [
  [/\bfintech|payments?|banking|lending|neobank|insurtech\b/, "fintech"],
  [/\bhealth ?tech|healthcare|medical|clinical|biotech|digital health\b/, "healthtech"],
  [/\b(ai|ml|machine learning|llm|artificial intelligence|foundation model)\b/, "ai_ml"],
  [/\bmarketplace|two[- ]sided|gig economy\b/, "marketplace"],
  [/\bsecurity|cyber ?security|infosec|appsec\b/, "security"],
  [/\bdev ?tools?|developer (?:tools|platform)|infrastructure|infra|platform engineering\b/, "devtools"],
  [/\be[- ]?commerce|retail|dtc|consumer goods\b/, "ecommerce"],
  [/\bcrypto|web3|blockchain|defi\b/, "crypto"],
  [/\bgaming|games? studio\b/, "gaming"],
  [/\blogistics|supply chain|freight\b/, "logistics"],
  [/\bed ?tech|education\b/, "edtech"],
  [/\bsaas|b2b software|enterprise software\b/, "saas"],
];

const STAGES: [RegExp, string][] = [
  [/\bpre[- ]?seed\b/, "pre_seed"],
  [/\bseed[- ]stage|\bseed\b/, "seed"],
  [/\bseries a\b/, "series_a"],
  [/\bseries b\b/, "series_b"],
  [/\bseries c\b/, "series_c"],
  [/\bseries d\b/, "series_d"],
  [/\bseries e\b|\bseries f\b|\blate[- ]stage\b/, "late_stage"],
  [/\bpublic(?:ly traded)?|post[- ]ipo|fortune 500|f500\b/, "public"],
  [/\bbootstrapped|profitable and independent\b/, "bootstrapped"],
  [/\bboutique|agency\b/, "boutique"],
  [/\bunicorn|growth[- ]stage|scale[- ]?up\b/, "growth"],
];

const REGIONS: [RegExp, string][] = [
  [/\b(us|u\.s\.|usa|united states|american|bay area|sf|san francisco|new york|nyc|seattle|austin|boston|chicago|denver|remote us)\b/, "north_america"],
  [/\b(canada|canadian|toronto|vancouver|montreal)\b/, "north_america"],
  [/\b(uk|u\.k\.|london|england|britain|british)\b/, "uk_ireland"],
  [/\b(ireland|dublin)\b/, "uk_ireland"],
  [/\b(europe|eu|berlin|amsterdam|paris|munich|stockholm|zurich|barcelona|lisbon)\b/, "europe"],
  [/\b(india|bangalore|bengaluru|hyderabad|mumbai|pune)\b/, "india"],
  [/\b(singapore|apac|australia|sydney|melbourne|japan|tokyo|korea|seoul)\b/, "apac"],
  [/\b(latam|brazil|mexico|argentina|sao paulo)\b/, "latam"],
];

const SIZE_BANDS: [RegExp, string][] = [
  [/\b(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*(?:people|employees|person)\b/, "1-50"],
  [/\b(?:\d{1,2}|a dozen)[-\s]?(?:person|people|employees?)\b/, "1-50"],
  [/\b(?:under|fewer than|less than)\s*(?:50|fifty)\b/, "1-50"],
  [/\b(?:50|fifty)\s*(?:-|to|–)\s*(?:100|hundred)\b/, "50-100"],
  [/\b(?:1\d\d|2\d\d|3\d\d|4\d\d)\s*(?:people|employees)\b/, "100-500"],
  [/\b(?:5\d\d|6\d\d|7\d\d|8\d\d|9\d\d)\s*(?:people|employees)\b/, "500-1000"],
  [/\b(?:thousands?|\d{1,2},\d{3})\s*(?:of\s*)?(?:people|employees)\b/, "1000+"],
];

/**
 * Outcome detection. Order matters — the first phrase the candidate actually
 * used wins. Note there is deliberately no rule mapping "rejected" to
 * "performance": a rejection tells us the process ended, not why, and the
 * only negative-reading category in the enum requires the candidate to have
 * said it themselves.
 */
const OUTCOMES: [RegExp, Outcome][] = [
  [/\b(req(?:uisition)? (?:was )?closed|role (?:was )?(?:closed|cancell?ed|frozen)|hiring freeze|backfill(?:ed)? cancell?ed|position eliminated)\b/, "req_closed"],
  [/\b(internal candidate|filled internally|went with someone internal|internal transfer|internal hire)\b/, "internal_candidate"],
  [/\b(comp(?:ensation)? (?:mismatch|misalign\w*|too low|couldn'?t match|gap)|salary (?:mismatch|expectations?|too low)|budget (?:mismatch|constraints?)|couldn'?t meet (?:my|the) (?:number|comp))\b/, "comp_mismatch"],
  [/\b(went with another candidate|chose another candidate|offered (?:it )?to someone else|another candidate (?:was )?stronger|competitive loss|lost to another)\b/, "competitive_loss"],
  [/\b(i withdrew|withdrew my|pulled out|declined (?:to continue|the process)|took another offer|accepted (?:a|another) (?:different )?offer elsewhere)\b/, "candidate_withdrew"],
  [/\b(failed the|didn'?t pass the|bombed|my performance|performance concerns?|feedback (?:was )?(?:that )?(?:i|my) (?:was )?(?:too )?(?:weak|light|lacking))\b/, "performance"],
];

/** Competency keywords the candidate mentioned directly, beyond round type. */
const COMPETENCY_KEYWORDS: [RegExp, string][] = [
  [/\bsql|database|postgres|query optimi[sz]ation\b/, "Database design"],
  [/\bkubernetes|docker|terraform|ci\/cd|devops\b/, "Infrastructure operations"],
  [/\bconcurrency|threading|async|race condition\b/, "Concurrency"],
  [/\bapi design|rest|graphql|grpc\b/, "API design"],
  [/\bmentor\w*|led a team|managed \d+|people management|direct reports\b/, "Engineering leadership"],
  [/\bproduct sense|prioriti[sz]ation|roadmap|stakeholder\b/, "Product judgement"],
  [/\btesting|test coverage|tdd\b/, "Testing discipline"],
  [/\bdebugging|incident|on[- ]call|postmortem|root cause\b/, "Operational debugging"],
  [/\bsecurity|threat model|auth\w*|encryption\b/, "Security reasoning"],
  [/\bmachine learning|model training|feature engineering|mlops\b/, "Applied ML"],
  [/\bfrontend|react|css|accessibility|browser\b/, "Frontend engineering"],
  [/\bdata (?:pipeline|modell?ing|warehouse)|etl|airflow|spark\b/, "Data engineering"],
];

export interface DeterministicParseResult {
  parsed: ParsedProcess;
  /** Human-readable trace of the rules that fired, shown in the UI. */
  trace: string[];
}

export function parseProcessDeterministic(args: {
  description: string;
  priorAnswers?: Record<string, string>;
}): DeterministicParseResult {
  // Clarification answers are appended so the same rules can read them —
  // this is what makes the re-submit path actually resolve the ambiguity
  // rather than just suppressing the question.
  const answerText = Object.values(args.priorAnswers ?? {}).join(" ").toLowerCase();
  const described = args.description.toLowerCase().replace(NON_ROUNDS, " ");
  const text = `${described} ${answerText}`.replace(NON_ROUNDS, " ");
  const trace: string[] = [];

  // ---- rounds -------------------------------------------------------------
  const detected = detectRounds(text, args.description);
  let rounds = detected.rounds;
  trace.push(
    detected.rounds.length > 0
      ? `Matched ${detected.rounds.length} round pattern(s): ${detected.rounds.map((r) => r.label).join(", ")}.`
      : "No round patterns matched the description.",
  );
  if (detected.droppedNonRounds > 0) {
    trace.push(`Ignored ${detected.droppedNonRounds} mention(s) that are not rounds (scheduling, rejection, debrief).`);
  }

  // ---- vagueness, and whether a clarification resolved it -----------------
  // The description and the answers are read separately here on purpose. A
  // vague quantifier in the original text is what triggered the question; an
  // explicit count in the answer is the candidate resolving it. Lumping the
  // two together would leave the ambiguity flag set forever and make answering
  // the question pointless.
  const vagueInDescription = VAGUE_QUANTIFIER.test(described);
  const countFromDescription = readExplicitRoundCount(described);
  const countFromAnswers = answerText ? readExplicitRoundCount(answerText) : null;
  const explicitCount = countFromDescription ?? countFromAnswers;
  const resolvedByAnswer = countFromDescription === null && countFromAnswers !== null;

  if (vagueInDescription && !resolvedByAnswer) {
    trace.push(`Vague quantifier present — emitting the lower bound and capping round-count confidence below 0.6.`);
  }
  if (countFromDescription !== null) {
    trace.push(`Candidate stated an explicit total of ${countFromDescription} round(s).`);
  }
  if (resolvedByAnswer) {
    trace.push(`Clarification resolved the round count to ${countFromAnswers} — the candidate stated it directly.`);
  }

  // A stated total higher than what we could name means there are rounds we
  // cannot describe. We record the count but never fabricate labels for them.
  const namedCount = rounds.length;
  const statedTotal = explicitCount;
  const roundsTotal: number | null = statedTotal ?? (namedCount > 0 ? namedCount : null);
  if (statedTotal !== null && statedTotal > namedCount) {
    trace.push(
      `Stated total (${statedTotal}) exceeds the ${namedCount} round(s) we can name — the extra rounds are counted but left unlabelled rather than invented.`,
    );
  }

  // ---- outcome ------------------------------------------------------------
  // Read before clearance, because a stated reason for the process ending
  // tells us the loop completed without an offer, which is what determines how
  // many rounds were cleared.
  const outcome = firstMatch(text, OUTCOMES) ?? "unstated";
  trace.push(
    outcome === "unstated"
      ? `Outcome recorded as "unstated": the description reports that the process ended but not why. A rejection is never read as a performance outcome.`
      : `Outcome "${outcome}" taken from the candidate's own words.`,
  );

  // ---- clearance ----------------------------------------------------------
  const answeredLastRound =
    (answerText.length > 0 && ROUND_PATTERNS.some((p) => p.re.test(answerText))) || statedReachedStage(text);
  const clearance = detectClearance(text, rounds.length, roundsTotal, outcome, answeredLastRound);
  rounds = rounds.map((r, i) => ({ ...r, index: i + 1, cleared: i < clearance.cleared }));
  const roundsCleared = Math.min(clearance.cleared, Math.max(roundsTotal ?? rounds.length, rounds.length));
  trace.push(clearance.reason);

  // ---- confidence ---------------------------------------------------------
  let roundsConfidence = 0.9;
  if (vagueInDescription && !resolvedByAnswer) roundsConfidence = 0.45;
  else if (namedCount === 0) roundsConfidence = 0.2;
  else if (resolvedByAnswer) roundsConfidence = 0.8;
  else if (statedTotal !== null && statedTotal !== namedCount) roundsConfidence = 0.55;
  else if (namedCount === 1) roundsConfidence = 0.7;
  if (clearance.ambiguous) roundsConfidence = Math.min(roundsConfidence, 0.55);
  trace.push(`Round-count confidence ${roundsConfidence.toFixed(2)}.`);

  // ---- employer profile ---------------------------------------------------
  const employerProfile = {
    sector: firstMatch(text, SECTORS),
    stage: firstMatch(text, STAGES),
    sizeBand: firstMatch(text, SIZE_BANDS),
    region: firstMatch(text, REGIONS),
  };
  trace.push(
    `Employer profile generalised to ${describeProfile(employerProfile)} — no company name is retained at any point.`,
  );

  // ---- competencies -------------------------------------------------------
  const competencies = deriveCompetencies(rounds, text);
  trace.push(`Derived ${competencies.length} competenc${competencies.length === 1 ? "y" : "ies"} from what was tested, not from a job description.`);

  // ---- loop length --------------------------------------------------------
  const loopLengthWeeks = readLoopLength(text);
  if (loopLengthWeeks !== null) trace.push(`Loop length ${loopLengthWeeks} week(s).`);

  // ---- tier (the real deterministic rule, not a fallback) -----------------
  const proposedTier = computeTier({
    roundsCleared,
    roundsConfidence,
    loopLengthWeeks,
    knownOfferRate: null,
  });
  trace.push(`Tier "${proposedTier}" from ${roundsCleared} round(s) cleared. Brand is not an input.`);

  // ---- clarifying questions ----------------------------------------------
  const questions = buildQuestions({
    vague: vagueInDescription && !resolvedByAnswer,
    namedCount,
    statedTotal,
    clearanceAmbiguous: clearance.ambiguous,
    outcome,
    hasStage: employerProfile.stage !== null,
    answered: args.priorAnswers ?? {},
  });
  if (questions.length > 0) {
    trace.push(`${questions.length} clarifying question(s) needed before this can be sized.`);
  }

  const processType: ParsedProcess["processType"] = /\binternal (?:role|move|transfer|posting)\b/.test(text)
    ? "internal"
    : "external";

  return {
    parsed: {
      rounds,
      roundsCleared,
      roundsTotal,
      roundsConfidence,
      processType,
      employerProfile,
      loopLengthWeeks,
      outcome,
      competencies,
      proposedTier,
      evidence: "self_attested",
      needsReview: roundsConfidence < 0.6,
      questions,
      notes: null,
    },
    trace,
  };
}

// ---------------------------------------------------------------------------

function detectRounds(
  text: string,
  original: string,
): { rounds: Round[]; droppedNonRounds: number } {
  const droppedNonRounds = (original.toLowerCase().match(NON_ROUNDS) ?? []).length;

  const hits: { pattern: RoundPattern; at: number; end: number }[] = [];
  for (const pattern of ROUND_PATTERNS) {
    const m = pattern.re.exec(text);
    if (!m || m.index === undefined) continue;
    hits.push({ pattern, at: m.index, end: m.index + m[0].length });
  }

  // A take-home and the review call for it are one round. If both a take-home
  // and a technical round matched but the text ties them together, keep the
  // take-home only.
  const tiedTogether = /\b(review(?:ing)? (?:the|my) take[- ]?home|walk(?:ed|ing)? through (?:the|my) (?:take[- ]?home|solution)|discuss(?:ed|ion of) (?:the|my) take[- ]?home)\b/.test(text);
  const filtered = tiedTogether
    ? hits.filter((h) => h.pattern.type !== "technical")
    : hits;

  // Two patterns can match the same words — "final panel" is both a panel and
  // a final round, and counting it twice would inflate the loop by a round we
  // invented. Overlapping matches collapse to the longest one, which is the
  // more specific description of what happened.
  filtered.sort((a, b) => a.at - b.at || b.end - a.end);
  const deduped: typeof filtered = [];
  for (const hit of filtered) {
    if (deduped.some((kept) => hit.at < kept.end && kept.at < hit.end)) continue;
    deduped.push(hit);
  }

  return {
    rounds: deduped.map((h, i) => ({
      index: i + 1,
      type: h.pattern.type,
      label: h.pattern.label,
      cleared: false,
    })),
    droppedNonRounds,
  };
}

function readExplicitRoundCount(text: string): number | null {
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const m =
    /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:total\s+)?(?:interview\s+)?(?:rounds?|stages?|interviews)\b/.exec(text);
  if (!m || !m[1]) return null;
  const n = words[m[1]] ?? Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 0 && n <= 15 ? n : null;
}

/**
 * Candidate-stated furthest stage. Distinct from the mail digest's
 * "last round the mail sequence reached", which is verification evidence
 * and must not be read as a clarifying-question trigger.
 */
function statedReachedStage(text: string): boolean {
  return (
    /\b(?:i |we )?(?:reached|made it to|got to|got through) (?:the )?(?:final|last|panel|onsite|system design|technical)(?: round| panel| interview| stage)?\b/i.test(
      text,
    ) || /\bthe last (?:round|stage) i (?:completed|did|reached|sat)\b/i.test(text)
  );
}

function detectClearance(
  text: string,
  namedCount: number,
  roundsTotal: number | null,
  outcome: Outcome,
  answeredLastRound: boolean,
): { cleared: number; reason: string; ambiguous: boolean } {
  const total = roundsTotal ?? namedCount;

  // "Rejected after the final round" / "made it to the end" — every round
  // happened, so every round was cleared except the one that ended it.
  if (/\b(rejected|turned down|passed over|no offer|didn'?t get it|got a no)\b.*\b(after|following)\b.*\b(final|last|panel|onsite)\b/.test(text)
    || /\b(final|last) (?:round|panel|stage)\b.*\b(rejected|turned down|no offer|didn'?t get)\b/.test(text)) {
    return {
      cleared: Math.max(total - 1, 0),
      reason: `Cleared ${Math.max(total - 1, 0)} of ${total} round(s): reaching the final round means the earlier rounds were cleared; the final one was not.`,
      ambiguous: false,
    };
  }

  if (/\b(received|got|accepted|signed) (?:an?|the) offer\b|\boffer (?:was )?(?:extended|made)\b/.test(text)) {
    return {
      cleared: total,
      reason: `Cleared all ${total} round(s): an offer was stated.`,
      ambiguous: false,
    };
  }

  // A rejection at a named earlier stage.
  const early = /\b(rejected|turned down|no offer|didn'?t (?:pass|get)|dropped) (?:me )?(?:after|at|in|following) (?:the )?(\w+(?: \w+)?) (?:round|interview|stage|screen)\b/.exec(text);
  if (early?.[1]) {
    const idx = ROUND_PATTERNS.findIndex((p) => p.re.test(early[1] ?? ""));
    const cleared = idx >= 0 ? Math.max(Math.min(idx, total - 1), 0) : Math.max(total - 1, 0);
    return {
      cleared,
      reason: `Cleared ${cleared} of ${total} round(s): the process ended at the ${early[1]} stage.`,
      ambiguous: false,
    };
  }

  if (/\b(still|currently) (?:in|interviewing|waiting)|\bin progress\b|\bawaiting\b/.test(text)) {
    return {
      cleared: Math.max(total - 1, 0),
      reason: `Process is still open — counting ${Math.max(total - 1, 0)} completed round(s) and no result.`,
      ambiguous: true,
    };
  }

  if (/\b(rejected|turned down|no offer|didn'?t get it)\b/.test(text)) {
    return {
      cleared: Math.max(total - 1, 0),
      reason: `Cleared ${Math.max(total - 1, 0)} of ${total} round(s): a rejection was stated but not the stage it happened at.`,
      ambiguous: !answeredLastRound,
    };
  }

  // The candidate gave a reason the process ended that isn't about them —
  // the requisition closed, an internal candidate took it, comp didn't line
  // up, someone else was chosen. All of those mean the loop ran to its end
  // without an offer, so the rounds before the decision were cleared. This is
  // not an inference about performance; it is what "they went with another
  // candidate" says about how far the process got.
  const ENDED_WITHOUT_OFFER: Outcome[] = ["req_closed", "internal_candidate", "comp_mismatch", "competitive_loss"];
  if (ENDED_WITHOUT_OFFER.includes(outcome)) {
    return {
      cleared: Math.max(total - 1, 0),
      reason: `Cleared ${Math.max(total - 1, 0)} of ${total} round(s): the candidate stated the process ended (${outcome.replace(/_/g, " ")}), so the loop ran its course without an offer.`,
      ambiguous: false,
    };
  }

  if (outcome === "candidate_withdrew") {
    return {
      cleared: Math.max(total - 1, 0),
      reason: `Cleared ${Math.max(total - 1, 0)} of ${total} round(s): the candidate withdrew, and the stage they withdrew at was not stated.`,
      ambiguous: !answeredLastRound,
    };
  }

  return {
    cleared: total,
    reason: `Counting all ${total} described round(s) as completed — no ending was stated.`,
    ambiguous: total > 0 && !answeredLastRound,
  };
}

function deriveCompetencies(rounds: Round[], text: string): Competency[] {
  const out = new Map<string, Competency>();
  const CAP = 8; // schema maximum

  // Pass 1: the headline competency of every round, at `assessed` depth.
  // Rounds are covered before any round's secondary competencies, so a long
  // loop doesn't spend the whole budget on its first two rounds and leave the
  // final round looking as though nothing was tested in it.
  for (const round of rounds) {
    if (out.size >= CAP) break;
    const pattern = ROUND_PATTERNS.find((p) => p.label === round.label);
    const name = pattern?.competencies[0];
    if (!name || out.has(name)) continue;
    out.set(name, { name, depth: "assessed", roundIndex: round.index });
  }

  // Pass 2: secondary competencies of each round, which were probed at most.
  for (const round of rounds) {
    if (out.size >= CAP) break;
    const pattern = ROUND_PATTERNS.find((p) => p.label === round.label);
    if (!pattern) continue;
    for (const name of pattern.competencies.slice(1)) {
      if (out.size >= CAP) break;
      if (!out.has(name)) out.set(name, { name, depth: "probed", roundIndex: round.index });
    }
  }

  // Pass 3: keywords the candidate raised themselves but that aren't tied to a
  // round we can identify. "mentioned" is the honest depth for those.
  for (const [re, name] of COMPETENCY_KEYWORDS) {
    if (out.size >= CAP) break;
    if (!re.test(text)) continue;
    if (!out.has(name)) out.set(name, { name, depth: "mentioned", roundIndex: null });
  }

  return [...out.values()];
}

function readLoopLength(text: string): number | null {
  const weeks = /\b(\d{1,2})\s*(?:-|to|–)?\s*(?:\d{1,2})?\s*weeks?\b/.exec(text);
  if (weeks?.[1]) {
    const n = Number.parseInt(weeks[1], 10);
    if (n >= 0 && n <= 52) return n;
  }
  const months = /\b(\d{1,2})\s*months?\b/.exec(text);
  if (months?.[1]) {
    const n = Number.parseInt(months[1], 10) * 4;
    if (n >= 0 && n <= 52) return n;
  }
  if (/\bover a month\b/.test(text)) return 5;
  if (/\ba month\b/.test(text)) return 4;
  return null;
}

function buildQuestions(args: {
  vague: boolean;
  namedCount: number;
  statedTotal: number | null;
  clearanceAmbiguous: boolean;
  outcome: Outcome;
  hasStage: boolean;
  answered: Record<string, string>;
}): string[] {
  const questions: string[] = [];
  const push = (q: string) => {
    // Never re-ask something the candidate already answered.
    if (questions.length < 3 && !args.answered[q]) questions.push(q);
  };

  if (args.vague || (args.statedTotal !== null && args.statedTotal !== args.namedCount)) {
    push("How many rounds in total, counting the recruiter screen?");
  }
  if (args.namedCount === 0) {
    push("Which rounds did the process have — screen, technical, design, panel?");
  }
  if (args.clearanceAmbiguous) {
    push("Which round was the last one you completed?");
  }
  // Deliberately no question about the outcome. The parser contract allows a
  // clarifying question "only when the answer would change the tier or round
  // count", and the outcome changes neither. An unstated outcome is recorded
  // as unstated and surfaces downstream as UNKNOWN in the brief, which is a
  // more honest result than nudging the candidate toward supplying a reason.
  return questions;
}

function firstMatch<T>(text: string, table: [RegExp, T][]): T | null {
  for (const [re, value] of table) {
    if (re.test(text)) return value;
  }
  return null;
}

function describeProfile(p: ParsedProcess["employerProfile"]): string {
  const parts = [p.stage, p.sector, p.sizeBand, p.region].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "an unspecified employer";
}

/** A complete, high-confidence loop is not worth a second model guess. */
export function modelParseIsWorthIt(parsed: ParsedProcess): boolean {
  return parsed.needsReview || parsed.questions.length > 0 || parsed.roundsConfidence < 0.75;
}
