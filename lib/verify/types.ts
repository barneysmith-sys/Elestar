/**
 * Verification agent output — structured, never free-form.
 *
 * Kept in src/types.ts's neighbourhood of product types so the agent layer
 * and the app share one shape. Recruiter email is intentionally absent.
 */

export type VerificationStatus = "verified" | "needs_review" | "failed";
export type PrivacyGate = "passed" | "failed" | "pending";

export interface VerificationEvidenceItem {
  id: string;
  kind: "catalog" | "live_public";
  source: string;
  claim: string;
  about: "company" | "role" | "process" | "recruiting";
}

export interface VerificationCheck {
  id: string;
  pass: boolean;
  label: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number;
  companyMatch: boolean;
  roleMatch: boolean;
  processMatch: boolean;
  evidence: VerificationEvidenceItem[];
  inconsistencies: string[];
  /** Concise decision factors shown to the candidate. Not chain-of-thought. */
  checks: VerificationCheck[];
  reasoning: string;
  privacyStatus: PrivacyGate;
  domain: string;
  companyLabel: string;
  evidenceKind: "catalog" | "live_public" | "none";
}

export function verificationChecks(args: {
  companyMatch: boolean;
  roleMatch: boolean;
  processMatch: boolean;
  found: boolean;
  stageSupported: boolean;
  contradictions: string[];
  status: VerificationStatus;
}): VerificationCheck[] {
  return [
    { id: "domain", pass: args.found && args.companyMatch, label: "Recruiter domain matches the company" },
    { id: "role", pass: args.roleMatch, label: "Email is consistent with the submitted role" },
    { id: "stage", pass: args.stageSupported, label: "Interview stage is supported by the forwarded mail" },
    { id: "conflict", pass: args.contradictions.length === 0, label: "No conflicting evidence" },
    { id: "public", pass: args.found && args.status === "verified", label: "Public company/role evidence is consistent" },
  ];
}
