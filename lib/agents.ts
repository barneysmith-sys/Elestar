import "server-only";

/**
 * The one place that decides whether a judgement step runs against a model or
 * against the deterministic reasoner, and the one place that records which
 * happened.
 *
 * Everything here returns an `engine` tag that travels all the way to the UI.
 * The product is allowed to degrade when there is no API key; it is not
 * allowed to be vague about having degraded. If a step ran on rules, the
 * screen says so.
 *
 * Note what does NOT live behind this switch, because it never degrades:
 * `redact()`, `computeTier()`, `K_FLOOR`, `DEPTH_WEIGHT` and
 * `recencyMultiplier` are deterministic Elestar logic and run identically
 * either way.
 */

import { auditRedaction } from "../src/redactionAudit";
import { buildInterviewBrief } from "../src/interviewBrief";
import { matchRecords } from "../src/matchRecords";
import { parseProcess } from "../src/parseProcess";
import type { MatchResult, ParsedProcess, RedactionAudit } from "../src/types";
import { getCapabilities, type Engine } from "./capabilities";
import { auditRedactionDeterministic } from "./reasoners/audit";
import { buildInterviewBriefDeterministic, type AnnotatedBrief } from "./reasoners/brief";
import { matchRecordsDeterministic } from "./reasoners/match";
import { parseProcessDeterministic, modelParseIsWorthIt } from "./reasoners/parse";
import { verifyProcessDeterministic } from "./reasoners/verify";
import type { RecruiterSignal } from "./verify/email";
import type { VerificationResult } from "./verify/types";

export interface Reasoned<T> {
  value: T;
  engine: Engine;
  /** Rule-by-rule explanation. Populated on the deterministic path. */
  trace: string[];
}

/**
 * Structure a description into a ParsedProcess.
 *
 * The model path is preferred when the deterministic parse is still missing
 * something. A complete, high-confidence mail digest is not worth a second
 * guess from the model — extra tokens do not make a named loop more true.
 */
export async function reasonParse(args: {
  description: string;
  knownNames?: string[];
  priorAnswers?: Record<string, string>;
}): Promise<Reasoned<ParsedProcess>> {
  const { parsed, trace } = parseProcessDeterministic(args);
  if (!modelParseIsWorthIt(parsed) || !getCapabilities().model) {
    return {
      value: parsed,
      engine: "deterministic",
      trace: modelParseIsWorthIt(parsed)
        ? trace
        : [...trace, "Skipped model — the mail already named a complete loop."],
    };
  }
  try {
    const value = await parseProcess(args);
    return { value, engine: "model", trace: [] };
  } catch {
    return { value: parsed, engine: "deterministic", trace };
  }
}

/**
 * Score a record for re-identification risk.
 *
 * There is no model-failure fallthrough here by design: `auditRedaction`
 * already fails closed to `withhold` on any error, and quietly retrying a
 * privacy decision on a weaker engine is exactly the wrong instinct. If the
 * model path was chosen and it failed, the record stays unpublished.
 */
export async function reasonAudit(args: {
  record: ParsedProcess;
  poolCohortCount: number;
}): Promise<Reasoned<RedactionAudit>> {
  if (getCapabilities().model) {
    const value = await auditRedaction(args);
    return { value, engine: "model", trace: [] };
  }
  const { audit, trace } = auditRedactionDeterministic(args);
  return { value: audit, engine: "deterministic", trace };
}

export async function reasonMatch(args: {
  roleDescription: string;
  candidates: { recordId: string; record: ParsedProcess; monthsAgo: number }[];
  limit?: number;
}): Promise<Reasoned<MatchResult[]>> {
  if (getCapabilities().model) {
    try {
      const value = await matchRecords(args);
      return { value, engine: "model", trace: [] };
    } catch {
      // Ranking is not a safety decision — degrading beats an empty result.
    }
  }
  const { results, trace } = matchRecordsDeterministic(args);
  return { value: results, engine: "deterministic", trace };
}

/**
 * Build the interview brief.
 *
 * The provenance annotation (`facts`, `confidence`) is a deterministic read of
 * the record itself, not of the prose, so it is computed the same way on both
 * paths — a model-written brief gets the same known/inferred/unknown ledger a
 * rule-written one does.
 */
export async function reasonBrief(args: {
  record: ParsedProcess;
  roleDescription: string;
  hiringLoop?: string[];
}): Promise<Reasoned<AnnotatedBrief>> {
  const annotated = buildInterviewBriefDeterministic(args);

  if (getCapabilities().model) {
    try {
      const model = await buildInterviewBrief(args);
      return {
        value: {
          ...model,
          facts: annotated.facts,
          confidence: annotated.confidence,
          confidenceBasis: annotated.confidenceBasis,
        },
        engine: "model",
        trace: [],
      };
    } catch {
      // Fall through to the fully deterministic brief.
    }
  }

  return { value: annotated, engine: "deterministic", trace: [] };
}

/**
 * Verify a structured process against public evidence for the recruiter domain.
 *
 * The mailbox is stripped before this function runs. v1 is deterministic-only;
 * if a model path is added later it still cannot bypass a `failed` status —
 * verification is a gate, not a suggestion.
 */
export async function reasonVerify(args: {
  signal: Omit<RecruiterSignal, "email">;
  parsed: ParsedProcess;
  role?: string;
  mailLastReached?: import("../src/types").RoundType | null;
  company?: import("./verify/resolve").ResolvedCompany;
  publicEvidence?: import("./verify/types").VerificationEvidenceItem[];
}): Promise<Reasoned<VerificationResult>> {
  const signal: RecruiterSignal = { ...args.signal, email: "" };
  const { verification, trace } = verifyProcessDeterministic({
    signal,
    parsed: args.parsed,
    role: args.role,
    mailLastReached: args.mailLastReached,
    company: args.company,
    publicEvidence: args.publicEvidence,
  });
  return { value: verification, engine: "deterministic", trace };
}
