import "server-only";
import { redact, assertRedacted } from "../src/redact";
import { parseProcess, computeTier } from "../src/parseProcess";
import { auditRedaction } from "../src/redactionAudit";
import type { ParsedProcess, RedactionAudit, Tier } from "../src/types";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type PipelineStep = "redact" | "parse" | "tier" | "audit" | "publish";
export type PipelineStatus = "running" | "ok" | "error" | "blocked";

export interface StepMessage {
  kind: "step";
  step: PipelineStep;
  status: PipelineStatus;
  message: string;
  data?: unknown;
}

export interface QuestionsMessage {
  kind: "questions";
  questions: string[];
  /** Echoed back so the client can re-submit priorAnswers against the same draft. */
  priorParse: ParsedProcess;
}

export interface DoneMessage {
  kind: "done";
  outcome: "published" | "pending_review" | "withheld" | "needs_clarification";
  dossierId?: string;
  tier?: Tier;
  reason: string;
}

export type PipelineMessage = StepMessage | QuestionsMessage | DoneMessage;

export interface RunPipelineArgs {
  userId: string;
  description: string;
  knownNames?: string[];
  priorAnswers?: Record<string, string>;
}

/**
 * Orchestrates redact -> parse -> tier -> audit -> publish and yields a
 * message per step. This function is the ONLY thing that writes to
 * Supabase for the listing flow, and it always uses the service-role
 * client — no agent in src/ ever touches the database, and RLS has no
 * write policy for anon/authenticated on any of these tables regardless.
 *
 * Fails closed throughout: any thrown error, any low-confidence parse, and
 * any redaction decision short of "publish" all end in something other
 * than a live public record.
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
    yield step("redact", "ok", `Redacted ${removedCount} identifying token(s) before anything left the server.`, r.removed);
  } catch {
    yield step("redact", "error", "Redaction failed, so nothing was sent anywhere. Stopping here.");
    yield done("withheld", undefined, undefined, "We couldn't safely process this yet. Nothing was published or shared.");
    return;
  }

  // ---- 2. parse --------------------------------------------------------
  yield step("parse", "running", "Reading your description and structuring it into rounds…");
  let parsed: ParsedProcess;
  try {
    parsed = await parseProcess({ description, knownNames, priorAnswers });
  } catch {
    // Both the first attempt and the one retry (inside callJSON) failed
    // schema validation. Fail closed: keep the raw submission for a human
    // to look at, compute nothing, publish nothing.
    yield step("parse", "error", "We couldn't parse this confidently after a retry. A person will review it.");
    await persistRawForReview(userId, description);
    yield done("pending_review", undefined, undefined, "This needs a person to look at it — we'll follow up.");
    return;
  }

  if (parsed.questions.length > 0) {
    yield step(
      "parse",
      "blocked",
      `${parsed.questions.length} quick question${parsed.questions.length > 1 ? "s" : ""} before we can size this correctly.`,
      parsed,
    );
    yield { kind: "questions", questions: parsed.questions, priorParse: parsed };
    return; // client collects answers and re-POSTs with priorAnswers
  }

  yield step("parse", "ok", `Parsed ${parsed.roundsCleared} round(s) cleared, proposed tier "${parsed.proposedTier}".`, parsed);

  // ---- 3. tier -----------------------------------------------------------
  // computeTier already ran inside parseProcess (it's what clamped
  // proposedTier); re-run it here only to show the rule's independent
  // verdict next to the model's, so the candidate can see why.
  yield step("tier", "running", "Applying the deterministic tier rules…");
  const ruleTier = computeTier({
    roundsCleared: parsed.roundsCleared,
    roundsConfidence: parsed.roundsConfidence,
    loopLengthWeeks: parsed.loopLengthWeeks,
    knownOfferRate: null,
  });
  yield step("tier", "ok", tierExplanation(parsed, ruleTier), { tier: parsed.proposedTier, ruleTier });

  if (parsed.needsReview || parsed.roundsConfidence < 0.6) {
    yield step("publish", "blocked", "Low-confidence parse — held for a person to confirm before it can publish.");
    const processId = await persistProcess(userId, description, parsed);
    await persistDossier(userId, processId, parsed, {
      riskScore: 0,
      quasiIdentifiers: [],
      kAnonymity: 0,
      decision: "withhold",
      generalizations: [],
      reason: "Pending human review before this can be sized and published.",
    });
    yield done("pending_review", undefined, parsed.proposedTier, "Held for human review — not published.");
    return;
  }

  // ---- 4. audit redaction -------------------------------------------------
  yield step("audit", "running", "Checking whether this can be published without identifying you…");
  let audit: RedactionAudit;
  try {
    const poolCohortCount = await getCohortCount(parsed);
    audit = await auditRedaction({ record: parsed, poolCohortCount });
  } catch {
    // auditRedaction already fails closed internally (returns withhold on
    // any error), but if the cohort-count query itself throws, mirror that
    // same fail-closed behavior rather than let an exception skip publish.
    audit = {
      riskScore: 100,
      quasiIdentifiers: [],
      kAnonymity: 0,
      decision: "withhold",
      generalizations: [],
      reason: "We could not confirm this is anonymous enough to publish yet. Nothing has been shared.",
    };
  }
  yield step("audit", audit.decision === "publish" ? "ok" : "blocked", auditMessage(audit), audit);

  // ---- 5. publish ----------------------------------------------------------
  const processId = await persistProcess(userId, description, parsed);
  const dossierId = await persistDossier(userId, processId, parsed, audit);

  if (audit.decision !== "publish") {
    yield step("publish", "blocked", "Not published — staying private for now.");
    yield done(
      audit.decision === "withhold" ? "withheld" : "pending_review",
      dossierId,
      parsed.proposedTier,
      audit.reason,
    );
    return;
  }

  yield step("publish", "ok", "Published — anonymized, live in the pool.");
  yield done("published", dossierId, parsed.proposedTier, "Live in the pool, fully anonymized.");
}

// ---------------------------------------------------------------------------

function step(step: PipelineStep, status: PipelineStatus, message: string, data?: unknown): StepMessage {
  return { kind: "step", step, status, message, data };
}

function done(
  outcome: DoneMessage["outcome"],
  dossierId: string | undefined,
  tier: Tier | undefined,
  reason: string,
): DoneMessage {
  return { kind: "done", outcome, dossierId, tier, reason };
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
    return `Clears the k-anonymity floor (k=${audit.kAnonymity}). Publishing anonymized.`;
  }
  if (audit.decision === "generalize") {
    return `Too identifiable as written (risk ${audit.riskScore}/100) — needs generalization before it can publish. ${audit.reason}`;
  }
  return `Withheld: ${audit.reason}`;
}

// ---- persistence: the ONLY place in the app that talks to Supabase --------
// Always the service-role client. Never called from a client component.

async function persistProcess(userId: string, rawDescription: string, parsed: ParsedProcess): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("processes")
    .insert({
      user_id: userId,
      raw_description: rawDescription,
      // employer_name_real: Phase 1's textarea-only intake never collects a
      // real employer name (the model never sees identity either), so this
      // stays null until a later phase adds a verified-employer flow.
      employer_name_real: null,
      rounds: parsed.rounds,
      parsed,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`persistProcess failed: ${error?.message}`);
  return data.id as string;
}

async function persistRawForReview(userId: string, rawDescription: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("processes").insert({
    user_id: userId,
    raw_description: rawDescription,
    employer_name_real: null,
    rounds: [],
    parsed: { needsReview: true, reason: "parse_failed_after_retry" },
  });
  if (error) throw new Error(`persistRawForReview failed: ${error.message}`);
}

async function persistDossier(
  userId: string,
  processId: string,
  parsed: ParsedProcess,
  audit: RedactionAudit,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const publicRecord = {
    roundsCleared: parsed.roundsCleared,
    roundsTotal: parsed.roundsTotal,
    outcome: parsed.outcome,
    competencies: parsed.competencies,
    loopLengthWeeks: parsed.loopLengthWeeks,
    employerProfile: parsed.employerProfile,
    processType: parsed.processType,
  };

  const { data, error } = await supabase
    .from("dossiers")
    .insert({
      process_id: processId,
      user_id: userId,
      tier: parsed.proposedTier,
      evidence: parsed.evidence,
      redaction_decision: audit.decision,
      public_record: publicRecord,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`persistDossier failed: ${error?.message}`);
  return data.id as string;
}

/**
 * Live count of published dossiers sharing this record's (tier, region,
 * quarter). This is a coarser proxy than the skill's full cohort key —
 * (tier band, function, seniority band, region, quarter) — because the
 * Phase 1 textarea-only intake has no structured function/seniority
 * fields yet. auditRedaction's own model-driven risk read of the whole
 * record is the primary defense; this count is the hard k=8 backstop, and
 * it is currently coarser than the skill specifies. Tightening it is
 * tracked as a fast-follow, not silently treated as equivalent.
 */
async function getCohortCount(parsed: ParsedProcess): Promise<number> {
  const supabase = getSupabaseAdmin();
  const region = parsed.employerProfile.region;
  const now = new Date();
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  const quarterEnd = new Date(Date.UTC(quarterStart.getUTCFullYear(), quarterStart.getUTCMonth() + 3, 1));

  let query = supabase
    .from("dossiers")
    .select("id", { count: "exact", head: true })
    .eq("tier", parsed.proposedTier)
    .eq("redaction_decision", "publish")
    .gte("created_at", quarterStart.toISOString())
    .lt("created_at", quarterEnd.toISOString());

  if (region) {
    query = query.eq("public_record->employerProfile->>region", region);
  }

  const { count, error } = await query;
  if (error) throw new Error(`getCohortCount failed: ${error.message}`);
  return count ?? 0;
}
