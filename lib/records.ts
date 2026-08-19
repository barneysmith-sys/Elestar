/**
 * Record shapes shared by the server and the browser.
 *
 * Kept out of lib/store.ts on purpose: that module is `server-only`, and the
 * views need these types. Nothing here carries identity — a `DossierRecord` is
 * the anonymised projection a recruiter is allowed to see, and the only place
 * an identity can appear at all is `IntroRequest.revealedIdentity`, which
 * stays null until the candidate approves.
 */

import type { Evidence, ParsedProcess, RedactionAudit, Tier } from "../src/types";

export interface DossierRecord {
  /** Anonymous public label, e.g. "A-1842". The only id a recruiter sees. */
  id: string;
  /** Underlying row id (uuid in Supabase, synthetic in memory). */
  rowId: string;
  processId: string;
  userId: string;
  tier: Tier;
  evidence: Evidence;
  redactionDecision: RedactionAudit["decision"];
  /** Anonymised structured record. Contains no identity by construction. */
  parsed: ParsedProcess;
  audit: RedactionAudit | null;
  createdAt: string;
  /** True for records seeded as demo data rather than submitted in-session. */
  demo: boolean;
}

export interface RevealedIdentity {
  channel: string;
  alias: string;
  note: string;
}

export type IntroStatus = "pending" | "approved" | "declined";

export interface IntroRequest {
  id: string;
  dossierId: string;
  candidateId: string;
  recruiterId: string;
  status: IntroStatus;
  /**
   * Null until the candidate approves. In Postgres a CHECK constraint makes a
   * non-null value on a non-approved row impossible.
   */
  revealedIdentity: RevealedIdentity | null;
  requestedAt: string;
  decidedAt: string | null;
  /** The role the recruiter was hiring for, so the brief has a target. */
  roleDescription: string;
}

// ---- display helpers, shared so every surface words these the same way ----

export const TIER_ORDER: Tier[] = ["apex", "elite", "verified", "standard"];

export const TIER_MEANING: Record<Tier, string> = {
  apex: "Six or more rounds cleared",
  elite: "Four to five rounds cleared",
  verified: "Three rounds cleared",
  standard: "Two rounds cleared",
};

export const ROUND_LABEL: Record<string, string> = {
  screen: "Screen",
  technical: "Technical",
  system_design: "System design",
  case: "Case",
  take_home: "Take-home",
  panel: "Panel",
  final: "Final",
  other: "Other",
};

export const OUTCOME_LABEL: Record<ParsedProcess["outcome"], string> = {
  req_closed: "Requisition closed",
  internal_candidate: "Went to an internal candidate",
  comp_mismatch: "Compensation mismatch",
  competitive_loss: "Another candidate chosen",
  candidate_withdrew: "Candidate withdrew",
  performance: "Performance (candidate-stated)",
  unstated: "Not stated",
};

export const DEPTH_LABEL: Record<string, string> = {
  assessed: "Assessed",
  probed: "Probed",
  mentioned: "Mentioned",
};

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  self_attested: "Self-attested",
  corroborated: "Corroborated",
  confirmed: "Confirmed",
  flagged: "Flagged",
};

/** How a record's employer is described once generalised. */
export function describeEmployer(parsed: ParsedProcess): string {
  const p = parsed.employerProfile;
  const stage = p.stage ? p.stage.replace(/_/g, " ") : null;
  const sector = p.sector ? p.sector.replace(/_/g, "/") : null;
  const parts = [stage, sector].filter(Boolean).join(" ");
  if (parts) return parts;
  return "Employer profile withheld";
}

export function describeScope(parsed: ParsedProcess): string {
  const p = parsed.employerProfile;
  return [p.sizeBand ? `${p.sizeBand} people` : null, p.region ? p.region.replace(/_/g, " ") : null]
    .filter(Boolean)
    .join(" · ");
}

/** Furthest named round — how far the loop got, without a company name. */
export function furthestRoundLabel(parsed: ParsedProcess): string {
  if (parsed.rounds.length === 0) return "Unstated";
  const last = parsed.rounds.reduce((best, round) => (round.index >= best.index ? round : best));
  return ROUND_LABEL[last.type] ?? last.label;
}

export function inferRoleFamily(parsed: ParsedProcess): string | null {
  const blob = parsed.competencies.map((c) => c.name.toLowerCase()).join(" ");
  if (/product judgement|product sense|prioriti/.test(blob)) return "product";
  if (/applied ml|data engineering|database design/.test(blob) && !/distributed systems/.test(blob)) return "data";
  if (/engineering leadership|people management/.test(blob)) return "engineering_leadership";
  if (/distributed|algorithms|api design|concurrency|infrastructure|frontend|security reasoning/.test(blob)) {
    return "engineering";
  }
  if (parsed.rounds.some((r) => r.type === "technical" || r.type === "system_design")) return "engineering";
  return null;
}

/** Whole months between now and an ISO timestamp. */
export function monthsSince(iso: string): number {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Math.max(0, Math.round(days / 30));
}

export function freshness(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
