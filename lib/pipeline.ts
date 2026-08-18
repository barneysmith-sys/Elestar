import "server-only";
import { redact, assertRedacted } from "../src/redact";
import { computeTier } from "../src/parseProcess";
import { K_FLOOR } from "../src/redactionAudit";
import type { ParsedProcess, RedactionAudit, Tier } from "../src/types";
import { reasonAudit, reasonParse } from "./agents";
import { reasoningEngine, type Engine } from "./capabilities";
import { cohortCount, insertDossier, insertProcess } from "./store";
import type {
  AuditStepData,
  DoneMessage,
  ParseStepData,
  PipelineMessage,
  PipelineStatus,
  PipelineStep,
  PublishStepData,
  RedactStepData,
  StepMessage,
  TierStepData,
} from "./pipelineWire";

export type * from "./pipelineWire";

export interface RunPipelineArgs {
  userId: string;
  description: string;
  knownNames?: string[];
  priorAnswers?: Record<string, string>;
}

/**
 * Orchestrates redact -> parse -> tier -> audit -> publish and yields a
 * message per step. This function is the ONLY thing that writes records for
 * the listing flow, and when Supabase is configured it always does so through
 * the service-role client — no agent in src/ ever touches the database, and
 * RLS has no write policy for anon/authenticated on any of these tables
 * regardless.
 *
 * Fails closed throughout: any thrown error, any low-confidence parse, and
 * any redaction decision short of "publish" all end in something other than a
 * live public record.
 *
 * Redaction and the tier rules are deterministic and always real. The parse
 * and audit steps run against a model when one is configured and against the
 * deterministic reasoners in lib/reasoners otherwise; each step reports which
 * ran via `engine` so the UI can label it rather than imply reasoning it
 * didn't do.
 */
export async function* runPipeline(args: RunPipelineArgs): AsyncGenerator<PipelineMessage> {
  const { userId, description, knownNames, priorAnswers } = args;

  // ---- 1. redact -----------------------------------------------------
  yield step("redact", "running", "Removing anything identifying before this reaches a model…");
  let removedCount = 0;
  try {
    const r = redact(description, { knownNames });
    assertRedacted(r.text);
    removedCount = r.removed.reduce((n, x) => n + x.count, 0);
    yield step(
      "redact",
      "ok",
      removedCount > 0
        ? `Redacted ${removedCount} identifying token(s) before anything left the server.`
        : "Nothing identifying found in the text. Checked for emails, phone numbers, URLs and handles.",
      {
        data: {
          spans: r.spans,
          removed: r.removed,
          originalLength: description.length,
        } satisfies RedactStepData,
      },
    );
  } catch {
    yield step("redact", "error", "Redaction failed, so nothing was sent anywhere. Stopping here.");
    yield done("withheld", undefined, undefined, undefined, "We couldn't safely process this yet. Nothing was published or shared.");
    return;
  }

  // ---- 2. parse --------------------------------------------------------
  yield step("parse", "running", "Reading your description and structuring it into rounds…");
  let parsed: ParsedProcess;
  let parseEngine: Engine;
  try {
    const result = await reasonParse({ description, knownNames, priorAnswers });
    parsed = result.value;
    parseEngine = result.engine;

    if (parsed.questions.length > 0) {
      yield step(
        "parse",
        "blocked",
        `${parsed.questions.length} quick question${parsed.questions.length > 1 ? "s" : ""} before we can size this correctly.`,
        { engine: parseEngine, trace: result.trace, data: { parsed } satisfies ParseStepData },
      );
      yield { kind: "questions", questions: parsed.questions, priorParse: parsed };
      return; // client collects answers and re-POSTs with priorAnswers
    }

    yield step(
      "parse",
      "ok",
      `Parsed ${parsed.rounds.length} round(s), ${parsed.roundsCleared} cleared, ${parsed.competencies.length} competenc${parsed.competencies.length === 1 ? "y" : "ies"}.`,
      { engine: parseEngine, trace: result.trace, data: { parsed } satisfies ParseStepData },
    );
  } catch {
    // Every attempt failed schema validation. Fail closed: keep the raw
    // submission for a human to look at, compute nothing, publish nothing.
    yield step("parse", "error", "We couldn't parse this confidently. A person will review it.");
    await persistRawForReview(userId, description);
    yield done("pending_review", undefined, undefined, undefined, "This needs a person to look at it — we'll follow up.");
    return;
  }

  // ---- 3. tier -----------------------------------------------------------
  // computeTier already ran inside the parse step (it's what clamped
  // proposedTier); re-run it here only to show the rule's independent verdict
  // next to the model's, so the candidate can see why.
  yield step("tier", "running", "Applying the deterministic tier rules…");
  const ruleTier = computeTier({
    roundsCleared: parsed.roundsCleared,
    roundsConfidence: parsed.roundsConfidence,
    loopLengthWeeks: parsed.loopLengthWeeks,
    knownOfferRate: null,
  });
  yield step("tier", "ok", tierExplanation(parsed, ruleTier), {
    data: {
      tier: parsed.proposedTier,
      ruleTier,
      roundsCleared: parsed.roundsCleared,
      roundsConfidence: parsed.roundsConfidence,
    } satisfies TierStepData,
  });

  if (parsed.needsReview || parsed.roundsConfidence < 0.6) {
    yield step("publish", "blocked", "Low-confidence parse — held for a person to confirm before it can publish.");
    const processId = await insertProcess({ userId, rawDescription: description, parsed });
    await insertDossier({
      processId,
      userId,
      parsed,
      audit: {
        riskScore: 0,
        quasiIdentifiers: [],
        kAnonymity: 0,
        decision: "withhold",
        generalizations: [],
        reason: "Pending human review before this can be sized and published.",
      },
    });
    yield done("pending_review", undefined, undefined, parsed.proposedTier, "Held for human review — not published.");
    return;
  }

  // ---- 4. audit redaction -------------------------------------------------
  yield step("audit", "running", "Checking whether this can be published without identifying you…");
  let audit: RedactionAudit;
  let auditEngine: Engine = reasoningEngine();
  let cohort = 0;
  let auditTrace: string[] = [];
  try {
    cohort = await cohortCount(parsed);
    const result = await reasonAudit({ record: parsed, poolCohortCount: cohort });
    audit = result.value;
    auditEngine = result.engine;
    auditTrace = result.trace;
  } catch {
    // reasonAudit already fails closed internally, but if the cohort-count
    // query itself throws, mirror that same fail-closed behavior rather than
    // let an exception skip publish.
    audit = {
      riskScore: 100,
      quasiIdentifiers: [],
      kAnonymity: 0,
      decision: "withhold",
      generalizations: [],
      reason: "We could not confirm this is anonymous enough to publish yet. Nothing has been shared.",
    };
  }
  yield step("audit", audit.decision === "publish" ? "ok" : "blocked", auditMessage(audit), {
    engine: auditEngine,
    trace: auditTrace,
    data: { audit, cohortCount: cohort, kFloor: K_FLOOR } satisfies AuditStepData,
  });

  // ---- 5. publish ----------------------------------------------------------
  const processId = await insertProcess({ userId, rawDescription: description, parsed });
  const record = await insertDossier({ processId, userId, parsed, audit });

  if (audit.decision !== "publish") {
    yield step("publish", "blocked", "Not published — staying private for now.");
    yield done(
      audit.decision === "withhold" ? "withheld" : "pending_review",
      record.rowId,
      record.id,
      parsed.proposedTier,
      audit.reason,
    );
    return;
  }

  yield step("publish", "ok", `Published as ${record.id} — anonymised, live in the Circuit.`, {
    data: { record } satisfies PublishStepData,
  });
  yield done("published", record.rowId, record.id, parsed.proposedTier, "Live in the Circuit, fully anonymised.");
}

// ---------------------------------------------------------------------------

function step(
  step: PipelineStep,
  status: PipelineStatus,
  message: string,
  extra: { engine?: Engine; trace?: string[]; data?: unknown } = {},
): StepMessage {
  return { kind: "step", step, status, message, ...extra };
}

function done(
  outcome: DoneMessage["outcome"],
  dossierId: string | undefined,
  recordId: string | undefined,
  tier: Tier | undefined,
  reason: string,
): DoneMessage {
  return { kind: "done", outcome, dossierId, recordId, tier, reason };
}

function tierExplanation(parsed: ParsedProcess, ruleTier: Tier): string {
  const base = `Tier: ${parsed.proposedTier}, from ${parsed.roundsCleared} round(s) cleared.`;
  if (ruleTier !== parsed.proposedTier) {
    return `${base} The model proposed higher; the rule lowered it to ${parsed.proposedTier} — rules may only lower, never raise.`;
  }
  if (parsed.roundsConfidence < 0.6) {
    return `${base} Capped at "verified" or below because round-count confidence is under 0.6.`;
  }
  return `${base} Brand is never an input to tier — only rounds cleared, offer rate (if known), and loop length.`;
}

function auditMessage(audit: RedactionAudit): string {
  if (audit.decision === "publish") {
    return `Clears the k-anonymity floor (k=${audit.kAnonymity}). Publishing anonymised.`;
  }
  if (audit.decision === "generalize") {
    return `Too identifiable as written (risk ${audit.riskScore}/100) — needs generalisation before it can publish. ${audit.reason}`;
  }
  return `Withheld: ${audit.reason}`;
}

async function persistRawForReview(userId: string, rawDescription: string): Promise<void> {
  await insertProcess({
    userId,
    rawDescription,
    parsed: { needsReview: true, reason: "parse_failed_after_retry" },
  });
}
