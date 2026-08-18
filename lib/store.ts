import "server-only";

/**
 * Persistence for the listing flow, behind one interface with two backends.
 *
 * Supabase is the real one: the schema in supabase/migrations enforces
 * anonymity in Postgres rather than in a display rule, and every write here
 * goes through the service-role client because RLS deliberately grants no
 * write policy to anon or authenticated.
 *
 * The in-memory backend exists so the product runs with no credentials at
 * all. It is NOT a different product — it stores the same records, applies
 * the same cohort query, and enforces the same intro-request invariant that
 * the `revealed_only_when_approved` CHECK constraint enforces in Postgres.
 * What it does not do is survive a restart, and it says so via
 * `persistenceLabel()`.
 */

import { getCapabilities } from "./capabilities";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { Evidence, ParsedProcess, RedactionAudit, Tier } from "../src/types";
import { SEED_DOSSIERS } from "./demoSeed";
import { recordLabel } from "./recordLabel";
import type { DossierRecord, IntroRequest, RevealedIdentity } from "./records";

export { recordLabel };
export type { DossierRecord, IntroRequest, RevealedIdentity };

// ---------------------------------------------------------------------------
// Memory backend
// ---------------------------------------------------------------------------

interface MemoryDb {
  dossiers: DossierRecord[];
  intros: IntroRequest[];
  processes: Map<string, { userId: string; rawDescription: string; parsed: unknown }>;
  seq: number;
}

/**
 * Held on globalThis so Next's dev-mode module reloading doesn't silently
 * reset the demo store between requests and make the Circuit look broken.
 */
const globalForDb = globalThis as unknown as { __elestarDb?: MemoryDb };

function memoryDb(): MemoryDb {
  if (!globalForDb.__elestarDb) {
    globalForDb.__elestarDb = {
      dossiers: [...SEED_DOSSIERS],
      intros: [],
      processes: new Map(),
      seq: 1,
    };
  }
  return globalForDb.__elestarDb;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function insertProcess(args: {
  userId: string;
  rawDescription: string;
  parsed: ParsedProcess | { needsReview: true; reason: string };
}): Promise<string> {
  if (getCapabilities().persistence) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("processes")
      .insert({
        user_id: args.userId,
        raw_description: args.rawDescription,
        // Phase 1's textarea-only intake never collects a real employer name
        // and the model never sees identity either, so this stays null.
        employer_name_real: null,
        rounds: "rounds" in args.parsed ? args.parsed.rounds : [],
        parsed: args.parsed,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`insertProcess failed: ${error?.message}`);
    return data.id as string;
  }

  const db = memoryDb();
  const id = `p-${db.seq++}`;
  db.processes.set(id, {
    userId: args.userId,
    rawDescription: args.rawDescription,
    parsed: args.parsed,
  });
  return id;
}

export async function insertDossier(args: {
  processId: string;
  userId: string;
  parsed: ParsedProcess;
  audit: RedactionAudit;
}): Promise<DossierRecord> {
  const { processId, userId, parsed, audit } = args;

  // The recruiter-browsable projection. Deliberately a whitelist rather than
  // a blacklist: a field has to be named here to ever reach a recruiter.
  const publicRecord = {
    roundsCleared: parsed.roundsCleared,
    roundsTotal: parsed.roundsTotal,
    roundsConfidence: parsed.roundsConfidence,
    rounds: parsed.rounds,
    outcome: parsed.outcome,
    competencies: parsed.competencies,
    loopLengthWeeks: parsed.loopLengthWeeks,
    employerProfile: parsed.employerProfile,
    processType: parsed.processType,
    proposedTier: parsed.proposedTier,
    evidence: parsed.evidence,
    needsReview: parsed.needsReview,
    questions: [],
    notes: null,
  } satisfies ParsedProcess;

  if (getCapabilities().persistence) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("dossiers")
      .insert({
        process_id: processId,
        user_id: userId,
        tier: parsed.proposedTier,
        evidence: parsed.evidence,
        redaction_decision: audit.decision,
        public_record: { ...publicRecord, audit },
      })
      .select("id, created_at")
      .single();
    if (error || !data) throw new Error(`insertDossier failed: ${error?.message}`);
    return {
      id: recordLabel(data.id as string),
      rowId: data.id as string,
      processId,
      userId,
      tier: parsed.proposedTier,
      evidence: parsed.evidence,
      redactionDecision: audit.decision,
      parsed: publicRecord,
      audit,
      createdAt: (data.created_at as string) ?? new Date().toISOString(),
      demo: false,
    };
  }

  const db = memoryDb();
  const rowId = `d-${db.seq++}`;
  const record: DossierRecord = {
    id: recordLabel(rowId),
    rowId,
    processId,
    userId,
    tier: parsed.proposedTier,
    evidence: parsed.evidence,
    redactionDecision: audit.decision,
    parsed: publicRecord,
    audit,
    createdAt: new Date().toISOString(),
    demo: false,
  };
  db.dossiers.unshift(record);
  return record;
}

/** Records a recruiter is allowed to browse: published only. */
export async function listPublishedDossiers(): Promise<DossierRecord[]> {
  if (getCapabilities().persistence) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("dossiers")
      .select("id, process_id, user_id, tier, evidence, redaction_decision, public_record, created_at")
      .eq("redaction_decision", "publish")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`listPublishedDossiers failed: ${error.message}`);
    return (data ?? []).map(rowToRecord);
  }

  return memoryDb()
    .dossiers.filter((d) => d.redactionDecision === "publish")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDossier(id: string): Promise<DossierRecord | null> {
  const all = await listPublishedDossiers();
  return all.find((d) => d.id === id || d.rowId === id) ?? null;
}

/**
 * Live count of published dossiers sharing this record's (tier, region,
 * quarter) — the input to the k-anonymity floor.
 *
 * This is a coarser proxy than the skill's full cohort key of (tier band,
 * function, seniority band, region, quarter), because the Phase 1
 * textarea-only intake has no structured function/seniority fields yet. The
 * risk read of the whole record is the primary defence; this count is the
 * hard k=8 backstop. Tightening it is a tracked fast-follow, not silently
 * treated as equivalent.
 */
export async function cohortCount(parsed: ParsedProcess): Promise<number> {
  const { start, end } = currentQuarter();

  if (getCapabilities().persistence) {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("dossiers")
      .select("id", { count: "exact", head: true })
      .eq("tier", parsed.proposedTier)
      .eq("redaction_decision", "publish")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

    if (parsed.employerProfile.region) {
      query = query.eq("public_record->employerProfile->>region", parsed.employerProfile.region);
    }

    const { count, error } = await query;
    if (error) throw new Error(`cohortCount failed: ${error.message}`);
    return count ?? 0;
  }

  const region = parsed.employerProfile.region;
  return memoryDb().dossiers.filter((d) => {
    if (d.redactionDecision !== "publish") return false;
    if (d.tier !== parsed.proposedTier) return false;
    const at = new Date(d.createdAt);
    if (at < start || at >= end) return false;
    if (region && d.parsed.employerProfile.region !== region) return false;
    return true;
  }).length;
}

// ---- intro requests -------------------------------------------------------

export async function createIntroRequest(args: {
  dossierId: string;
  recruiterId: string;
  roleDescription: string;
}): Promise<IntroRequest> {
  const dossier = await getDossier(args.dossierId);
  if (!dossier) throw new Error("createIntroRequest: no such published dossier");

  const existing = (await listIntroRequests()).find(
    (r) => r.dossierId === dossier.id && r.recruiterId === args.recruiterId && r.status !== "declined",
  );
  if (existing) return existing;

  if (getCapabilities().persistence) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("intro_requests")
      .insert({
        dossier_id: dossier.rowId,
        candidate_id: dossier.userId,
        recruiter_id: args.recruiterId,
        status: "pending",
        // revealed_identity stays null: the CHECK constraint would reject a
        // value here anyway, which is the point of putting it in the schema.
      })
      .select("id, requested_at")
      .single();
    if (error || !data) throw new Error(`createIntroRequest failed: ${error?.message}`);
    return {
      id: data.id as string,
      dossierId: dossier.id,
      candidateId: dossier.userId,
      recruiterId: args.recruiterId,
      status: "pending",
      revealedIdentity: null,
      requestedAt: (data.requested_at as string) ?? new Date().toISOString(),
      decidedAt: null,
      roleDescription: args.roleDescription,
    };
  }

  const db = memoryDb();
  const intro: IntroRequest = {
    id: `i-${db.seq++}`,
    dossierId: dossier.id,
    candidateId: dossier.userId,
    recruiterId: args.recruiterId,
    status: "pending",
    revealedIdentity: null,
    requestedAt: new Date().toISOString(),
    decidedAt: null,
    roleDescription: args.roleDescription,
  };
  db.intros.unshift(intro);
  return intro;
}

export async function listIntroRequests(): Promise<IntroRequest[]> {
  if (getCapabilities().persistence) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("intro_requests")
      .select("id, dossier_id, candidate_id, recruiter_id, status, revealed_identity, requested_at, decided_at")
      .order("requested_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(`listIntroRequests failed: ${error.message}`);

    const dossiers = await listPublishedDossiers();
    const labelByRowId = new Map(dossiers.map((d) => [d.rowId, d.id]));
    return (data ?? []).map((r) => ({
      id: r.id as string,
      dossierId: labelByRowId.get(r.dossier_id as string) ?? recordLabel(r.dossier_id as string),
      candidateId: r.candidate_id as string,
      recruiterId: r.recruiter_id as string,
      status: r.status as IntroRequest["status"],
      revealedIdentity: (r.revealed_identity as RevealedIdentity | null) ?? null,
      requestedAt: r.requested_at as string,
      decidedAt: (r.decided_at as string | null) ?? null,
      roleDescription: "",
    }));
  }

  return memoryDb().intros;
}

export async function getIntroRequest(id: string): Promise<IntroRequest | null> {
  return (await listIntroRequests()).find((r) => r.id === id) ?? null;
}

/**
 * The candidate's decision. This is the only transition that can ever attach
 * an identity to a record, and the invariant is enforced here rather than
 * assumed: a declined request can never carry a revealed identity, and an
 * approval is the only thing that creates one.
 */
export async function decideIntro(args: {
  introId: string;
  decision: "approved" | "declined";
}): Promise<IntroRequest> {
  const revealed: RevealedIdentity | null =
    args.decision === "approved" ? demoRevealedIdentity() : null;

  if (getCapabilities().persistence) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("intro_requests")
      .update({
        status: args.decision,
        revealed_identity: revealed,
        decided_at: new Date().toISOString(),
      })
      .eq("id", args.introId)
      .select("id")
      .single();
    if (error || !data) throw new Error(`decideIntro failed: ${error?.message}`);
    const updated = await getIntroRequest(args.introId);
    if (!updated) throw new Error("decideIntro: request vanished after update");
    return updated;
  }

  const intro = memoryDb().intros.find((r) => r.id === args.introId);
  if (!intro) throw new Error("decideIntro: no such request");
  intro.status = args.decision;
  intro.decidedAt = new Date().toISOString();
  intro.revealedIdentity = revealed;
  return intro;
}

/**
 * What "unlock" actually releases in a deployment with no real users.
 *
 * Inventing a plausible name and email here would be the single most
 * dishonest thing this codebase could do — it would demo beautifully and it
 * would be a fabricated human being. The state machine is real; the payload
 * says exactly what it is.
 */
function demoRevealedIdentity(): RevealedIdentity {
  return {
    channel: "Elestar relay",
    alias: "Candidate contact released",
    note:
      "In a live deployment this is the candidate's own contact details, released at this moment and not before. " +
      "This deployment has no real candidates, so no identity exists to release — the approval gate itself is real.",
  };
}

// ---------------------------------------------------------------------------

function rowToRecord(r: Record<string, unknown>): DossierRecord {
  const publicRecord = (r.public_record ?? {}) as ParsedProcess & { audit?: RedactionAudit };
  const { audit, ...parsed } = publicRecord;
  return {
    id: recordLabel(r.id as string),
    rowId: r.id as string,
    processId: r.process_id as string,
    userId: r.user_id as string,
    tier: r.tier as Tier,
    evidence: r.evidence as Evidence,
    redactionDecision: r.redaction_decision as RedactionAudit["decision"],
    parsed: parsed as ParsedProcess,
    audit: audit ?? null,
    createdAt: r.created_at as string,
    demo: false,
  };
}

export function monthsAgo(iso: string): number {
  const then = new Date(iso).getTime();
  const days = (Date.now() - then) / 86_400_000;
  return Math.max(0, Math.round(days / 30));
}

function currentQuarter(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
  return { start, end };
}
