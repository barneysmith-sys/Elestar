import "server-only";
import { redact, assertRedacted } from "../src/redact";
import { computeTier } from "../src/parseProcess";
import { K_FLOOR } from "../src/redactionAudit";
import type { ParsedProcess, RedactionAudit, Tier } from "../src/types";
import { reasonAudit, reasonParse, reasonVerify } from "./agents";
import { reasoningEngine, type Engine } from "./capabilities";
import {
  isFixtureId,
  PROVE_INBOX,
  receiveFixture,
  receiveInbound,
  type FixtureId,
} from "./ingest/inbound";
import { cohortCount, insertDossier, insertProcess, listPublishedDossiers } from "./store";
import { assertNoRecruiterEmail, maskEmail, parseRecruiterSignal } from "./verify/email";
import { addEvidence, emptyLedger, summarise, type EvidenceLedger } from "./evidence";
import { collectPublicEvidence, MAX_RESEARCH_ATTEMPTS, planResearch, resolveCompany, type ResolvedCompany } from "./verify/resolve";
import { verificationChecks } from "./verify/types";
import { logPipeline, newPipelineId } from "./observe";
import { buildCircuitGraph } from "./circuitGraph";
import type {
  AuditStepData,
  DoneMessage,
  IdentifyStepData,
  MatchStepData,
  ParseMailStepData,
  PipelineMessage,
  PipelineStatus,
  PipelineStep,
  PlanStepData,
  PlaceStepData,
  PublishStepData,
  ReceiveStepData,
  ResearchStepData,
  StepMessage,
} from "./pipelineWire";
import { STEP_EVENT } from "./pipelineWire";

export type * from "./pipelineWire";

export interface RunPipelineArgs {
  userId: string;
  description?: string;
  forwardedEmails?: string;
  knownNames?: string[];
  priorAnswers?: Record<string, string>;
  recruiterEmail?: string;
  role?: string;
  /** Demo: process a canned inbound as if it arrived at prove@elestar.ai. */
  fixture?: FixtureId;
  simulation?: boolean;
  pipelineId?: string;
  signal?: AbortSignal;
}

/**
 * Orchestrates the verification pipeline:
 *   receive → parse_mail → identify → plan → research → match → audit → publish
 *
 * Production trigger is an email arriving at prove@elestar.ai. The demo
 * calls the same function with a fixture id and `simulation: true`.
 */
export async function* runPipeline(args: RunPipelineArgs): AsyncGenerator<PipelineMessage> {
  const simulation = Boolean(args.simulation || args.fixture);
  const pipelineId = args.pipelineId ?? newPipelineId();
  const started = Date.now();
  const aborted = () => Boolean(args.signal?.aborted);
  logPipeline({ event: "pipeline_start", pipelineId, simulation });
  const inbound = args.fixture && isFixtureId(args.fixture)
    ? receiveFixture(args.fixture, true)
    : receiveInbound({
        raw: args.forwardedEmails?.trim() ?? "",
        notes: args.description,
        role: args.role,
        simulation,
      });

  const notes = (args.description?.trim() || inbound.notes).trim();
  const raw = inbound.raw;
  const sourceText = [notes, raw].filter(Boolean).join("\n\n");
  const { userId, priorAnswers } = args;
  const mail = inbound.evidence;
  const recruiterEmails = [
    ...mail.recruiterEmails,
    ...(args.recruiterEmail ? [args.recruiterEmail] : []),
  ];
  const recruiterEmail =
    mail.primarySignal.email || args.recruiterEmail || recruiterEmails[0] || undefined;
  const role = (args.role?.trim() || inbound.role || mail.extractedRole || "").trim();
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
    extra: { engine?: Engine; trace?: string[]; data?: unknown; durationMs?: number } = {},
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
    logPipeline({
      event: "pipeline_end",
      pipelineId,
      stage: "done",
      outcome,
      simulation,
      durationMs: Date.now() - started,
      decision: outcome,
      holdReason: outcome === "published" ? undefined : reason.slice(0, 160),
    });
    return msg;
  };

  if (aborted()) {
    yield finish("withheld", undefined, undefined, undefined, "The request was cancelled. Nothing was published.");
    return;
  }

  // ---- 1. receive --------------------------------------------------------
  yield emit("receive", "running", `Inbound at ${PROVE_INBOX}…`);
  yield emit(
    "receive",
    mail.messages.length > 0 ? "ok" : "blocked",
    mail.messages.length > 0
      ? simulation
        ? `Simulated arrival at ${PROVE_INBOX} — ${mail.messages.length} message(s). The browser did not send mail.`
        : `Received ${mail.messages.length} forwarded message(s) at ${PROVE_INBOX}.`
      : `Nothing arrived at ${PROVE_INBOX}. Forward a recruiter or interview email to verify.`,
    {
      engine: "deterministic",
      trace: [
        simulation
          ? `DEMO MODE · simulated ingest. Production uses the same pipeline when mail arrives at ${PROVE_INBOX}.`
          : `Inbound accepted at ${PROVE_INBOX}.`,
        ...mail.trace,
      ],
      data: { arrival: inbound.arrival } satisfies ReceiveStepData,
    },
  );

  if (mail.messages.length === 0 && !notes) {
    yield finish(
      "withheld",
      undefined,
      undefined,
      undefined,
      `No forwarded email was received at ${PROVE_INBOX}. Nothing was published.`,
    );
    return;
  }

  // ---- 2. parse mail (redact first, then extract signals) ----------------
  yield emit("parse_mail", "running", "Parsing interview signals from the forwarded mail…");
  let removedCount = 0;
  let redactedNotes = notes;
  try {
    const r = redact(sourceText, { knownNames });
    assertRedacted(r.text);
    removedCount = r.removed.reduce((n, x) => n + x.count, 0);
    redactedNotes = redact(notes, { knownNames }).text;
    const parseMailData: ParseMailStepData = {
      messageCount: mail.messages.length,
      processSignals: mail.processSignals,
      lastReachedLabel: mail.lastReachedLabel,
      interviewDate: mail.interviewDate,
      extractedRole: mail.extractedRole,
      fromDomain: mail.primarySignal.domain,
      maskedFrom: inbound.arrival.fromMasked,
      subjects: mail.messages.map((m) => m.subject),
      removed: r.removed,
      spans: r.spans,
      originalLength: sourceText.length,
    };
    yield emit(
      "parse_mail",
      "ok",
      mail.lastReachedLabel
        ? `Last round reached: ${mail.lastReachedLabel}. ${removedCount > 0 ? `Stripped ${removedCount} identifying token(s).` : "No identifiers in the mail body."}`
        : `Parsed ${mail.messages.length} message(s). ${removedCount > 0 ? `Stripped ${removedCount} identifying token(s).` : ""}`.trim(),
      { engine: "deterministic", trace: mail.trace, data: parseMailData },
    );
  } catch {
    yield emit("parse_mail", "error", "Could not safely read the forwarded mail. Stopping here.");
    yield finish("withheld", undefined, undefined, undefined, "We couldn't safely process this yet. Nothing was published or shared.");
    return;
  }

  const parseSource = mail.digest ? `${mail.digest}\n\n${redactedNotes}` : redactedNotes;
  const parseSafe = redact(parseSource, { knownNames });
  assertRedacted(parseSafe.text);
  const parseInput = parseSafe.text;

  // ---- 3. identify company + role (structure the loop) -------------------
  yield emit("identify", "running", "Identifying company, role and how far the loop got…");
  let parsed: ParsedProcess;
  let parseEngine: Engine;
  let parseTrace: string[] = [];
  try {
    const result = await reasonParse({ description: parseInput, knownNames, priorAnswers });
    parsed = result.value;
    parseEngine = result.engine;
    parseTrace = result.trace;

    if (parsed.questions.length > 0) {
      yield emit(
        "identify",
        "blocked",
        `${parsed.questions.length} quick question${parsed.questions.length > 1 ? "s" : ""} before we can size this correctly.`,
        {
          engine: parseEngine,
          trace: result.trace,
          data: identifyData(parsed, parsed.proposedTier, mail, role),
        },
      );
      const questionsMsg = { kind: "questions" as const, questions: parsed.questions, priorParse: parsed };
      leakCheck(questionsMsg);
      yield questionsMsg;
      return;
    }
  } catch {
    yield emit("identify", "error", "We couldn't parse this confidently. A person will review it.");
    await persistRawForReview(userId, sourceText, recruiterEmail);
    yield finish("pending_review", undefined, undefined, undefined, "This needs a person to look at it — we'll follow up.");
    return;
  }

  const ruleTier = computeTier({
    roundsCleared: parsed.roundsCleared,
    roundsConfidence: parsed.roundsConfidence,
    loopLengthWeeks: parsed.loopLengthWeeks,
    knownOfferRate: null,
  });

  yield emit(
    "identify",
    "ok",
    [
      role ? `Role: ${role}.` : mail.extractedRole ? `Role: ${mail.extractedRole}.` : "Role unstated.",
      mail.primarySignal.domain ? `Sender domain ${mail.primarySignal.domain}.` : "No company domain.",
      `Tier ${parsed.proposedTier} from ${parsed.roundsCleared} round(s) cleared.`,
    ].join(" "),
    {
      engine: parseEngine,
      trace: [
        ...parseTrace,
        role ? `Role taken as "${role}".` : "No role named.",
        `Sender domain ${mail.primarySignal.domain || "(none)"}. The mailbox stays private.`,
        tierExplanation(parsed, ruleTier),
      ],
      data: identifyData(parsed, ruleTier, mail, role),
    },
  );

  if (parsed.needsReview || parsed.roundsConfidence < 0.6) {
    yield emit("publish", "blocked", "Low-confidence parse — held for a person to confirm before it can publish.");
    const processId = await insertProcess({ userId, rawDescription: sourceText, parsed, recruiterEmail });
    await insertDossier({
      processId,
      userId,
      parsed,
      demo: simulation,
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

  // ---- 4-5. plan, research, replan from what was found --------------------
  const signal = parseRecruiterSignal(recruiterEmail);
  const researchDomain = mail.primarySignal.domain || signal.domain;
  let company: ResolvedCompany = resolveCompany("");
  let publicEvidence: ResearchStepData["evidence"] = [];
  let ledger = emptyLedger();
  if (mail.primarySignal.domain) {
    ledger = addEvidence(ledger, {
      id: "mail-domain",
      claim: `Recruiter domain ${mail.primarySignal.domain}`,
      source: "forwarded-mail",
      sourceType: "mail",
      confidence: 0.9,
      status: "probable",
      about: "recruiting",
      contradictions: [],
    });
  }
  if (mail.lastReachedLabel) {
    ledger = addEvidence(ledger, {
      id: "mail-stage",
      claim: `Forwarded mail reached ${mail.lastReachedLabel}`,
      source: "forwarded-mail",
      sourceType: "mail",
      confidence: 0.85,
      status: "probable",
      about: "process",
      contradictions: [],
    });
  }
  let attempt = 1;
  let plan = planResearch(researchDomain, {
    attempt,
    evidenceCount: ledger.items.length,
  });

  while (attempt <= MAX_RESEARCH_ATTEMPTS) {
    const planStarted = Date.now();
    yield emit("plan", "running", attempt === 1 ? "Deciding what still needs evidence…" : "Updating the plan from the evidence so far…");
    const planLine =
      plan.decision === "stop"
        ? `Enough catalog evidence for ${plan.domain}. Stopping research.`
        : plan.decision === "hold"
          ? plan.lookalikeOf
            ? `Lookalike of ${plan.lookalikeOf} — holding rather than matching.`
            : plan.missing.includes("conflict_resolution")
              ? "Sources disagree. Preserving both claims and holding."
              : plan.action === "skip_no_domain"
                ? "No recruiter domain — skipping company research rather than inventing one."
                : `No catalog evidence for ${plan.domain}. Holding that gap rather than crawling a guess.`
          : plan.tools.length
            ? `Catalog lookup for ${plan.domain}. Tools: ${plan.tools.join(", ")}.`
            : `Need more evidence for ${plan.domain}.`;
    logPipeline({
      event: "plan",
      pipelineId,
      stage: "plan",
      attempt,
      simulation,
      durationMs: Date.now() - planStarted,
      tool: plan.tools.join(",") || undefined,
      decision: plan.decision,
      holdReason: plan.decision === "hold" ? (plan.lookalikeOf ? `lookalike:${plan.lookalikeOf}` : plan.missing[0]) : undefined,
      replan: attempt > 1,
    });
    yield emit("plan", "ok", planLine, {
        engine: "deterministic",
        durationMs: Date.now() - planStarted,
        trace: [
          `Plan attempt ${attempt}: ${plan.action} → ${plan.decision}.`,
          plan.tools.length ? `Tools: ${plan.tools.join(", ")}.` : "No research tools selected.",
          plan.missing.length ? `Missing: ${plan.missing.join(", ")}.` : "No required fields missing for a catalog check.",
          plan.lookalikeOf ? `Near-miss of ${plan.lookalikeOf} is not a match.` : "No lookalike warning.",
        ],
        data: {
          action: plan.action,
          decision: plan.decision,
          tools: plan.tools,
          missing: plan.missing,
          domain: plan.domain,
          attempt,
          lookalikeOf: plan.lookalikeOf ?? null,
        } satisfies PlanStepData,
      },
    );

    if (aborted()) {
      yield finish("withheld", undefined, undefined, undefined, "The request was cancelled. Nothing was published.");
      return;
    }

    if (plan.tools.length === 0) {
      if (plan.decision !== "research_again") break;
      attempt += 1;
      plan = planResearch(plan.domain || researchDomain, { attempt, companyFound: company.found, evidenceCount: publicEvidence.length });
      continue;
    }

    const researchStarted = Date.now();
    yield emit("research", "running", "Checking public company and role evidence…");
    const targetDomain = plan.domain || researchDomain;
    if (plan.tools.includes("resolveCompany") && !(company.found && company.domain === targetDomain)) {
      company = resolveCompany(targetDomain);
    }
    if (plan.tools.includes("collectPublicEvidence") && publicEvidence.length === 0) {
      publicEvidence = collectPublicEvidence(company).map((e) => ({
        id: e.id,
        kind: e.kind,
        source: e.source,
        claim: e.claim,
        about: e.about,
      }));
    }

    const conflicts: string[] = [];
    if (company.found && parsed.employerProfile.sector && company.sector && parsed.employerProfile.sector !== company.sector) {
      conflicts.push(`Submission sector (${parsed.employerProfile.sector}) vs catalog (${company.sector}).`);
    }
    if (mail.lastReached && parsed.rounds.some((round) => round.type === "final") && mail.lastReached === "screen") {
      conflicts.push("Forwarded mail only supports a screen; the notes claim a later stage.");
    }

    if (mail.primarySignal.domain) {
      ledger = addEvidence(ledger, {
        id: "mail-domain",
        claim: `Recruiter domain ${mail.primarySignal.domain}`,
        source: "forwarded-mail",
        sourceType: "mail",
        confidence: 0.9,
        status: "probable",
        about: "recruiting",
        contradictions: [],
      });
    }
    for (const item of publicEvidence) {
      ledger = addEvidence(ledger, {
        id: item.id,
        claim: item.claim,
        source: item.source,
        sourceType: "catalog",
        confidence: 0.8,
        status: conflicts.length ? "contradicted" : "probable",
        about: item.about,
        contradictions: conflicts,
      });
    }
    const summarised: EvidenceLedger = summarise(ledger.items, conflicts);

    const researchData: ResearchStepData = {
      domain: signal.domain,
      companyLabel: company.found ? company.displayName : signal.domain || "(none)",
      found: company.found,
      evidenceKind: company.found ? "catalog" : "none",
      sector: company.sector,
      stage: company.stage,
      evidence: publicEvidence,
      independentSources: summarised.independentSources,
      overall: summarised.overall,
      conflicts,
      attempt,
      plan: { action: plan.action, decision: plan.decision, tools: plan.tools, missing: plan.missing },
    };
    logPipeline({
      event: "research",
      pipelineId,
      stage: "research",
      attempt,
      simulation,
      durationMs: Date.now() - researchStarted,
      tool: plan.tools.join(",") || undefined,
      sourceCount: summarised.independentSources,
      evidenceCount: publicEvidence.length,
      decision: plan.decision,
      replan: attempt > 1,
    });
    yield emit(
      "research",
      "ok",
      company.found
        ? `Catalog evidence for ${company.displayName} (${publicEvidence.length} public signal(s), ${summarised.independentSources} independent). Not a live crawl.`
        : signal.domain
          ? `No public catalog evidence for ${signal.domain}. Holding rather than inventing a company.`
          : "No company domain to research.",
      {
        engine: "deterministic",
        durationMs: Date.now() - researchStarted,
        trace: [
          company.found
            ? `Resolved ${signal.domain} to a catalog profile. Evidence kind: catalog.`
            : "Unknown or empty domain — no public profile.",
          conflicts.length ? `Conflicts preserved: ${conflicts.join(" ")}` : "No source conflicts.",
        ],
        data: researchData,
      },
    );

    const next = planResearch(plan.domain || researchDomain, {
      attempt: attempt + 1,
      companyFound: company.found,
      evidenceCount: publicEvidence.length,
      conflicts,
    });
    if (next.decision !== "research_again" || next.tools.length === 0) break;
    plan = next;
    attempt += 1;
  }

  // ---- 5. cross-check / verification agent -------------------------------
  yield emit("match", "running", "Cross-checking the mail against the stated experience and public evidence…");

  if (signal.kind === "invalid" || !signal.email) {
    const matchData = matchPayload(signal.domain, maskEmail(signal.email), {
      status: "failed",
      confidence: 0,
      companyMatch: false,
      roleMatch: false,
      processMatch: false,
      evidence: [],
      inconsistencies: [signal.reason],
      checks: verificationChecks({
        companyMatch: false,
        roleMatch: false,
        processMatch: false,
        found: false,
        stageSupported: false,
        contradictions: [signal.reason],
        status: "failed",
      }),
      reasoning: signal.reason,
      privacyStatus: "pending",
      domain: signal.domain,
      companyLabel: signal.domain || "(none)",
      evidenceKind: "none",
    }, role, mail);
    yield emit("match", "blocked", "No usable company signal from the forwarded From: line — nothing will be published.", {
      engine: "deterministic",
      data: matchData,
    });
    await persistRawForReview(userId, sourceText, recruiterEmail);
    yield finish(
      "pending_review",
      undefined,
      undefined,
      parsed.proposedTier,
      "A company recruiter address on the forwarded mail is required to verify this process. Nothing was published.",
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
      mailLastReached: mail.lastReached,
      company,
      publicEvidence,
    });
    verification = result.value;
    verifyTrace = result.trace;
  } catch {
    yield emit("match", "error", "Verification failed closed. Nothing was published.");
    await persistRawForReview(userId, sourceText, recruiterEmail);
    yield finish("withheld", undefined, undefined, parsed.proposedTier, "We couldn't verify this yet. Nothing was published or shared.");
    return;
  }

  const matchData = matchPayload(verification.domain, maskEmail(signal.email), verification, role, mail);
  leakCheck(matchData);

  if (verification.status === "failed") {
    yield emit("match", "blocked", verification.reasoning, {
      engine: "deterministic",
      trace: verifyTrace,
      data: matchData,
    });
    const processId = await insertProcess({ userId, rawDescription: sourceText, parsed, recruiterEmail });
    await insertDossier({
      processId,
      userId,
      parsed,
      demo: simulation,
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
    yield emit("match", "blocked", verification.reasoning, {
      engine: "deterministic",
      trace: verifyTrace,
      data: matchData,
    });
    const processId = await insertProcess({ userId, rawDescription: sourceText, parsed, recruiterEmail });
    await insertDossier({
      processId,
      userId,
      parsed,
      demo: simulation,
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
  yield emit("match", "ok", verification.reasoning, {
    engine: "deterministic",
    trace: verifyTrace,
    data: matchData,
  });

  // ---- 6. privacy audit --------------------------------------------------
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

  // ---- 7. publication decision -------------------------------------------
  const processId = await insertProcess({ userId, rawDescription: sourceText, parsed, recruiterEmail });
  const record = await insertDossier({ processId, userId, parsed, audit, demo: simulation });
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

  yield emit("publish", "ok", `Verified and published as ${record.id} — anonymised, live in the Circuit.`, {
    data: { record } satisfies PublishStepData,
  });

  yield emit("place", "running", "Placing the record on the Circuit from overlapping evidence…");
  const published = await listPublishedDossiers();
  const graph = buildCircuitGraph(published);
  const neighbors = graph.edges
    .filter((edge) => edge.from === record.id || edge.to === record.id)
    .map((edge) => ({
      id: edge.from === record.id ? edge.to : edge.from,
      relationship: edge.relationship,
      confidence: edge.confidence,
      evidence: edge.evidence,
    }));
  const placeData: PlaceStepData = { recordId: record.id, pool: published.length, neighbors };
  leakCheck(placeData);
  yield emit(
    "place",
    "ok",
    neighbors.length > 0
      ? `Placed next to ${neighbors.length} evidenced neighbor${neighbors.length === 1 ? "" : "s"} in a pool of ${published.length}.`
      : `Live in the Circuit. No evidenced neighbor yet in this pool of ${published.length}.`,
    { engine: "deterministic", data: placeData },
  );

  yield finish("published", record.rowId, record.id, parsed.proposedTier, "Live in the Circuit, fully anonymised.");
}

function identifyData(
  parsed: ParsedProcess,
  ruleTier: Tier,
  mail: { lastReachedLabel: string | null; processSignals: string[]; interviewDate: string | null; primarySignal: { domain: string } },
  role: string,
): IdentifyStepData {
  return {
    recruiterDomain: mail.primarySignal.domain,
    role: role || null,
    lastReachedLabel: mail.lastReachedLabel,
    processSignals: mail.processSignals,
    interviewDate: mail.interviewDate,
    parsed,
    tier: parsed.proposedTier,
    ruleTier,
    roundsCleared: parsed.roundsCleared,
    roundsConfidence: parsed.roundsConfidence,
  };
}

function matchPayload(
  domain: string,
  maskedSignal: string,
  verification: MatchStepData["verification"],
  role: string,
  mail: { lastReachedLabel: string | null; processSignals: string[] },
): MatchStepData {
  return {
    domain,
    maskedSignal,
    verification,
    structured: {
      company: verification.companyLabel,
      role: role || null,
      interview_signal: mail.lastReachedLabel,
      recruiter_domain: domain,
      process_signals: mail.processSignals,
      evidence: verification.evidence,
      confidence: verification.confidence,
      status: verification.status,
    },
  };
}

function step(
  stepName: PipelineStep,
  status: PipelineStatus,
  message: string,
  extra: { engine?: Engine; trace?: string[]; data?: unknown; durationMs?: number } = {},
): StepMessage {
  const event =
    status === "running"
      ? STEP_EVENT[stepName].running
      : status === "error" || status === "blocked"
        ? stepName === "publish" || stepName === "match" || stepName === "audit"
          ? "failed"
          : STEP_EVENT[stepName].settled
        : STEP_EVENT[stepName].settled;
  return { kind: "step", step: stepName, status, message, event, ...extra };
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
