import "server-only";
import { redact, assertRedacted } from "../src/redact";
import { computeTier } from "../src/parseProcess";
import { K_FLOOR } from "../src/redactionAudit";
import type { ParsedProcess, RedactionAudit, Tier } from "../src/types";
import { reasonAudit, reasonParse, reasonVerify } from "./agents";
import { reasoningEngine, type Engine } from "./capabilities";
import { cohortCount, insertDossier, insertProcess } from "./store";
import { assertNoRecruiterEmail, maskEmail, parseRecruiterSignal } from "./verify/email";
import { parseForwardedMail } from "./verify/forwardedMail";
import type {
  AuditStepData,
  DoneMessage,
  IngestStepData,
  ParseStepData,
  PipelineMessage,
  PipelineStatus,
  PipelineStep,
  PublishStepData,
  RedactStepData,
  StepMessage,
  TierStepData,
  VerifyStepData,
} from "./pipelineWire";

export type * from "./pipelineWire";

export interface RunPipelineArgs {
  userId: string;
  /** Optional notes — company stage, extra context the mail doesn't carry. */
  description: string;
  /** Recruiter emails the candidate forwarded. Primary evidence of how far they got. */
  forwardedEmails?: string;
  knownNames?: string[];
  priorAnswers?: Record<string, string>;
  recruiterEmail?: string;
  role?: string;
}

/**
 * Orchestrates ingest -> redact -> parse -> tier -> verify -> audit -> publish
 * and yields a message per step. This function is the ONLY thing that writes
 * records for the listing flow, and when Supabase is configured it always
 * does so through the service-role client — no agent in src/ ever touches the
 * database, and RLS has no write policy for anon/authenticated on any of
 * these tables regardless.
 *
 * Fails closed throughout: any thrown error, any low-confidence parse, a
 * failed recruiter-domain verification, and any redaction decision short of
 * "publish" all end in something other than a live public record.
 *
 * Candidates forward recruiter mail. The ingest step reads those messages to
 * see how far the loop got. The From: domain is the verification credential.
 * The mailbox is never yielded on a pipeline message, never copied onto a
 * public record, and asserted absent from every step payload before it leaves here.
 */
export async function* runPipeline(args: RunPipelineArgs): AsyncGenerator<PipelineMessage> {
  const notes = args.description.trim();
  const forwardedEmails = args.forwardedEmails?.trim() ?? "";
  const sourceText = [notes, forwardedEmails].filter(Boolean).join("\n\n");
  const { userId, priorAnswers, role } = args;

  const mail = parseForwardedMail(forwardedEmails);
  const recruiterEmails = [
    ...mail.recruiterEmails,
    ...(args.recruiterEmail ? [args.recruiterEmail] : []),
  ];
  const recruiterEmail =
    mail.primarySignal.email || args.recruiterEmail || recruiterEmails[0] || undefined;
  const knownNames = [
    ...(args.knownNames ?? []),
    ...recruiterEmails,
    ...mail.senderNames,
  ];

  const leakCheck = (payload: unknown) => {
    assertNoRecruiterEmail(payload, recruiterEmails);
  };

  const emit = (
    name: PipelineStep,
    status: PipelineStatus,
    message: string,
    extra: { engine?: Engine; trace?: string[]; data?: unknown } = {},
  ): StepMessage => {
    if (extra.data !== undefined) leakCheck(extra.data);
    const msg = step(name, status, message, extra);
    leakCheck(msg);
    return msg;
  };

  const finish = (
    outcome: DoneMessage["outcome"],
    dossierId: string | undefined,
    recordId: string | undefined,
    tier: Tier | undefined,
    reason: string,
  ): DoneMessage => {
    const msg = done(outcome, dossierId, recordId, tier, reason);
    leakCheck(msg);
    return msg;
  };

  // ---- 1. ingest forwarded mail ------------------------------------------
  yield emit("ingest", "running", "Reading the forwarded recruiter mail for how far the loop got…");
  const ingestData: IngestStepData = {
    messageCount: mail.messages.length,
    lastReachedLabel: mail.lastReachedLabel,
    fromDomain: mail.primarySignal.domain,
    messages: mail.messages.map((m) => ({
      subject: m.subject,
      date: m.date,
      fromDomain: m.fromDomain,
      maskedFrom: m.maskedFrom,
      signalLabels: m.signals.map((s) => `${s.label} · ${s.event}`),
    })),
  };
  yield emit(
    "ingest",
    "ok",
    mail.messages.length > 0
      ? `Read ${mail.messages.length} forwarded message(s). Last round reached: ${mail.lastReachedLabel ?? "unstated"}.`
      : "No forwarded messages. Using the candidate's notes.",
    { engine: "deterministic", trace: mail.trace, data: ingestData },
  );

  // ---- 2. redact -----------------------------------------------------
  yield emit("redact", "running", "Removing anything identifying before this reaches a model…");
  let removedCount = 0;
  let redactedText = sourceText;
  try {
    const r = redact(sourceText, { knownNames });
    assertRedacted(r.text);
    removedCount = r.removed.reduce((n, x) => n + x.count, 0);
    redactedText = r.text;
    yield emit(
      "redact",
      "ok",
      removedCount > 0
        ? `Redacted ${removedCount} identifying token(s) before anything left the server.`
        : "Nothing identifying found in the text. Checked for emails, phone numbers, URLs and handles.",
      {
        data: {
          spans: r.spans,
          removed: r.removed,
          originalLength: sourceText.length,
        } satisfies RedactStepData,
      },
    );
  } catch {
    yield emit("redact", "error", "Redaction failed, so nothing was sent anywhere. Stopping here.");
    yield finish("withheld", undefined, undefined, undefined, "We couldn't safely process this yet. Nothing was published or shared.");
    return;
  }

  const parseInput = mail.digest
    ? `${mail.digest}\n\n${redact(notes, { knownNames }).text}`
    : redactedText;

  // ---- 3. parse --------------------------------------------------------
  yield emit("parse", "running", "Reading your description and structuring it into rounds…");
  let parsed: ParsedProcess;
  let parseEngine: Engine;
  try {
    const result = await reasonParse({ description: parseInput, knownNames, priorAnswers });
    parsed = result.value;
    parseEngine = result.engine;

    if (parsed.questions.length > 0) {
      yield emit(
        "parse",
        "blocked",
        `${parsed.questions.length} quick question${parsed.questions.length > 1 ? "s" : ""} before we can size this correctly.`,
        { engine: parseEngine, trace: result.trace, data: { parsed } satisfies ParseStepData },
      );
      const questionsMsg = { kind: "questions" as const, questions: parsed.questions, priorParse: parsed };
      leakCheck(questionsMsg);
      yield questionsMsg;
      return; // client collects answers and re-POSTs with priorAnswers
    }

    yield emit(
      "parse",
      "ok",
      `Parsed ${parsed.rounds.length} round(s), ${parsed.roundsCleared} cleared, ${parsed.competencies.length} competenc${parsed.competencies.length === 1 ? "y" : "ies"}.`,
      { engine: parseEngine, trace: result.trace, data: { parsed } satisfies ParseStepData },
    );
  } catch {
    // Every attempt failed schema validation. Fail closed: keep the raw
    // submission for a human to look at, compute nothing, publish nothing.
    yield emit("parse", "error", "We couldn't parse this confidently. A person will review it.");
    await persistRawForReview(userId, sourceText, recruiterEmail);
    yield finish("pending_review", undefined, undefined, undefined, "This needs a person to look at it — we'll follow up.");
    return;
  }

  // ---- 4. tier -----------------------------------------------------------
  // computeTier already ran inside the parse step (it's what clamped
  // proposedTier); re-run it here only to show the rule's independent verdict
  // next to the model's, so the candidate can see why.
  yield emit("tier", "running", "Applying the deterministic tier rules…");
  const ruleTier = computeTier({
    roundsCleared: parsed.roundsCleared,
    roundsConfidence: parsed.roundsConfidence,
    loopLengthWeeks: parsed.loopLengthWeeks,
    knownOfferRate: null,
  });
  yield emit("tier", "ok", tierExplanation(parsed, ruleTier), {
    data: {
      tier: parsed.proposedTier,
      ruleTier,
      roundsCleared: parsed.roundsCleared,
      roundsConfidence: parsed.roundsConfidence,
    } satisfies TierStepData,
  });

  if (parsed.needsReview || parsed.roundsConfidence < 0.6) {
    yield emit("publish", "blocked", "Low-confidence parse — held for a person to confirm before it can publish.");
    const processId = await insertProcess({ userId, rawDescription: sourceText, parsed, recruiterEmail });
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
    yield finish("pending_review", undefined, undefined, parsed.proposedTier, "Held for human review — not published.");
    return;
  }

  // ---- 5. verify recruiter signal ----------------------------------------
  yield emit("verify", "running", "Resolving the recruiter domain and comparing public evidence…");
  const signal = parseRecruiterSignal(recruiterEmail);

  if (signal.kind === "invalid" || !signal.email) {
    const verifyData: VerifyStepData = {
      domain: signal.domain,
      maskedSignal: maskEmail(signal.email),
      verification: {
        status: "failed",
        confidence: 0,
        companyMatch: false,
        roleMatch: false,
        processMatch: false,
        evidence: [],
        inconsistencies: [signal.reason],
        reasoning: signal.reason,
        privacyStatus: "pending",
        domain: signal.domain,
        companyLabel: signal.domain || "(none)",
        evidenceKind: "none",
      },
    };
    yield emit("verify", "blocked", "No usable recruiter signal — nothing will be published.", {
      engine: "deterministic",
      data: verifyData,
    });
    await persistRawForReview(userId, sourceText, recruiterEmail);
    yield finish(
      "pending_review",
      undefined,
      undefined,
      parsed.proposedTier,
      "A company recruiter address is required to verify this process. Nothing was published.",
    );
    return;
  }

  let verification;
  let verifyTrace: string[] = [];
  try {
    const result = await reasonVerify({
      signal: { domain: signal.domain, localPart: signal.localPart, kind: signal.kind, reason: signal.reason },
      parsed,
      role,
    });
    verification = result.value;
    verifyTrace = result.trace;
  } catch {
    yield emit("verify", "error", "Verification failed closed. Nothing was published.");
    await persistRawForReview(userId, sourceText, recruiterEmail);
    yield finish("withheld", undefined, undefined, parsed.proposedTier, "We couldn't verify this yet. Nothing was published or shared.");
    return;
  }

  const verifyData: VerifyStepData = {
    domain: verification.domain,
    maskedSignal: maskEmail(signal.email),
    verification,
  };
  leakCheck(verifyData);

  if (verification.status === "failed") {
    yield emit("verify", "blocked", verification.reasoning, {
      engine: "deterministic",
      trace: verifyTrace,
      data: verifyData,
    });
    const processId = await insertProcess({ userId, rawDescription: sourceText, parsed, recruiterEmail });
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
        reason: verification.reasoning,
      },
    });
    yield emit("publish", "blocked", "Not published — verification did not pass.");
    yield finish("withheld", undefined, undefined, parsed.proposedTier, verification.reasoning);
    return;
  }

  if (verification.status === "needs_review") {
    yield emit("verify", "blocked", verification.reasoning, {
      engine: "deterministic",
      trace: verifyTrace,
      data: verifyData,
    });
    const processId = await insertProcess({ userId, rawDescription: sourceText, parsed, recruiterEmail });
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
        reason: verification.reasoning,
      },
    });
    yield emit("publish", "blocked", "Held for review — verification was not automatic.");
    yield finish("pending_review", undefined, undefined, parsed.proposedTier, verification.reasoning);
    return;
  }

  parsed = { ...parsed, evidence: "corroborated" };
  yield emit("verify", "ok", verification.reasoning, {
    engine: "deterministic",
    trace: verifyTrace,
    data: verifyData,
  });

  // ---- 6. audit redaction -------------------------------------------------
  yield emit("audit", "running", "Checking whether this can be published without identifying you…");
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
  yield emit("audit", audit.decision === "publish" ? "ok" : "blocked", auditMessage(audit), {
    engine: auditEngine,
    trace: auditTrace,
    data: { audit, cohortCount: cohort, kFloor: K_FLOOR } satisfies AuditStepData,
  });

  // ---- 7. publish ----------------------------------------------------------
  const processId = await insertProcess({ userId, rawDescription: sourceText, parsed, recruiterEmail });
  const record = await insertDossier({ processId, userId, parsed, audit });
  assertNoRecruiterEmail(record, recruiterEmails);

  if (audit.decision !== "publish") {
    yield emit("publish", "blocked", "Not published — staying private for now.");
    yield finish(
      audit.decision === "withhold" ? "withheld" : "pending_review",
      record.rowId,
      record.id,
      parsed.proposedTier,
      audit.reason,
    );
    return;
  }

  yield emit("publish", "ok", `Published as ${record.id} — anonymised, live in the Circuit.`, {
    data: { record } satisfies PublishStepData,
  });
  yield finish("published", record.rowId, record.id, parsed.proposedTier, "Live in the Circuit, fully anonymised.");
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

async function persistRawForReview(
  userId: string,
  rawDescription: string,
  recruiterEmail?: string,
): Promise<void> {
  await insertProcess({
    userId,
    rawDescription,
    parsed: { needsReview: true, reason: "parse_failed_after_retry" },
    recruiterEmail,
  });
}
