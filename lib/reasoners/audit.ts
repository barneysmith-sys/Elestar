/**
 * Deterministic re-identification audit — the no-API-key path for
 * `auditRedaction`.
 *
 * The part that matters most here is not a fallback at all: the k=8 floor in
 * `K_FLOOR` is a hard rule, and it is applied identically whether the risk
 * read came from a model or from this file. What this adds is a transparent
 * quasi-identifier score in place of the model's judgement.
 *
 * The reasoning is real k-anonymity reasoning: every field the record states
 * precisely narrows the set of people it could describe. Stage + sector +
 * size + region + an exact round count is often enough to name someone at a
 * small company, and this scores exactly that. It fails closed — a record it
 * cannot clear is generalised or withheld, never published on a guess.
 */

import { K_FLOOR } from "../../src/redactionAudit";
import type { ParsedProcess, RedactionAudit } from "../../src/types";

/**
 * How much each stated field narrows the candidate pool, 0..100. These are
 * ordered by how identifying the field actually is: a precise headcount at a
 * seed-stage company is far more identifying than a continent.
 */
const FIELD_RISK: { field: string; weight: number; get: (r: ParsedProcess) => string | null }[] = [
  { field: "employerProfile.sizeBand", weight: 22, get: (r) => r.employerProfile.sizeBand },
  { field: "employerProfile.stage", weight: 18, get: (r) => r.employerProfile.stage },
  { field: "employerProfile.sector", weight: 16, get: (r) => r.employerProfile.sector },
  { field: "employerProfile.region", weight: 10, get: (r) => r.employerProfile.region },
  { field: "loopLengthWeeks", weight: 8, get: (r) => (r.loopLengthWeeks === null ? null : `${r.loopLengthWeeks}w`) },
  { field: "outcome", weight: 6, get: (r) => (r.outcome === "unstated" ? null : r.outcome) },
];

/** Small-company signals: being identifiable is much easier at these. */
const SMALL_ORG_STAGES = new Set(["pre_seed", "seed", "series_a", "boutique"]);
const SMALL_SIZE_BANDS = new Set(["1-50", "50-100"]);

export interface DeterministicAuditResult {
  audit: RedactionAudit;
  trace: string[];
}

export function auditRedactionDeterministic(args: {
  record: ParsedProcess;
  poolCohortCount: number;
}): DeterministicAuditResult {
  const { record, poolCohortCount } = args;
  const trace: string[] = [];

  // ---- quasi-identifier scoring -------------------------------------------
  const quasiIdentifiers: RedactionAudit["quasiIdentifiers"] = [];
  let riskScore = 0;

  for (const { field, weight, get } of FIELD_RISK) {
    const value = get(record);
    if (value === null) continue;
    quasiIdentifiers.push({ field, value, contribution: weight });
    riskScore += weight;
  }

  trace.push(
    `${quasiIdentifiers.length} quasi-identifier(s) stated, contributing ${riskScore}/100 before structural adjustments.`,
  );

  // A long, precisely-described loop is itself identifying — few processes
  // have six named rounds, so the shape of the loop narrows the pool.
  const namedRounds = record.rounds.length;
  if (namedRounds >= 5) {
    const bump = Math.min((namedRounds - 4) * 6, 18);
    riskScore += bump;
    quasiIdentifiers.push({ field: "rounds.length", value: `${namedRounds} named rounds`, contribution: bump });
    trace.push(`Loop shape adds ${bump}: a ${namedRounds}-round process is uncommon enough to narrow the pool.`);
  }

  // Small organisations are the dominant risk factor. Being one of four
  // senior backend hires at a 30-person seed company is close to a name.
  const stage = record.employerProfile.stage;
  const size = record.employerProfile.sizeBand;
  if ((stage && SMALL_ORG_STAGES.has(stage)) || (size && SMALL_SIZE_BANDS.has(size))) {
    riskScore += 15;
    trace.push(`Small-organisation signal adds 15: at this stage or headcount the candidate pool is inherently narrow.`);
  }

  riskScore = Math.min(Math.round(riskScore), 100);

  // ---- k-anonymity --------------------------------------------------------
  // The cohort count is the live number of published records sharing this
  // record's (tier, region, quarter). It is a measured value, not an estimate.
  const kAnonymity = poolCohortCount;
  trace.push(`Measured cohort size k=${kAnonymity} against a floor of k=${K_FLOOR}.`);

  // ---- decision -----------------------------------------------------------
  const generalizations: RedactionAudit["generalizations"] = [];
  let decision: RedactionAudit["decision"];
  let reason: string;

  if (kAnonymity < K_FLOOR) {
    // The hard floor. This is the same rule the model path is subject to —
    // `auditRedaction` overrides a model that says "publish" below the floor.
    decision = "generalize";
    reason =
      `Only ${kAnonymity} published record(s) share this record's cohort, below the k=${K_FLOOR} floor. ` +
      `It stays unpublished until the cohort is large enough to hide in, or until the details are generalised further.`;
    for (const qi of quasiIdentifiers.slice(0, 3)) {
      generalizations.push({ field: qi.field, from: qi.value, to: generalize(qi.field, qi.value) });
    }
    trace.push(`Below the k-anonymity floor — hard rule, applied before any judgement about risk score.`);
  } else if (riskScore >= 75) {
    decision = "withhold";
    reason =
      `This record is too specific to publish as written (re-identification risk ${riskScore}/100). ` +
      `Nothing has been shared. You can broaden the employer details and resubmit.`;
    trace.push(`Risk ${riskScore} at or above the withhold threshold of 75.`);
  } else if (riskScore >= 50) {
    decision = "generalize";
    reason =
      `Publishable, but not at this level of detail (risk ${riskScore}/100). ` +
      `The fields below are broadened first so the record can't be traced back to one process.`;
    for (const qi of quasiIdentifiers.slice(0, 3)) {
      generalizations.push({ field: qi.field, from: qi.value, to: generalize(qi.field, qi.value) });
    }
    trace.push(`Risk ${riskScore} in the generalise band (50–74).`);
  } else {
    decision = "publish";
    reason = `Clears the k-anonymity floor (k=${kAnonymity}) at re-identification risk ${riskScore}/100. Publishing anonymised.`;
    trace.push(`Risk ${riskScore} below 50 and cohort above the floor — clear to publish.`);
  }

  return {
    audit: { riskScore, quasiIdentifiers, kAnonymity, decision, generalizations, reason },
    trace,
  };
}

/** The coarser value a field becomes when it has to be broadened. */
function generalize(field: string, value: string): string {
  switch (field) {
    case "employerProfile.sizeBand":
      return SMALL_SIZE_BANDS.has(value) ? "under 500" : "500+";
    case "employerProfile.stage":
      return SMALL_ORG_STAGES.has(value) ? "early-stage" : "growth-or-later";
    case "employerProfile.sector":
      return "withheld";
    case "employerProfile.region":
      return "global";
    case "loopLengthWeeks":
      return "multi-week";
    case "rounds.length":
      return "4+ rounds";
    case "outcome":
      return "unstated";
    default:
      return "withheld";
  }
}
