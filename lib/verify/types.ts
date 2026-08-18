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

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number;
  companyMatch: boolean;
  roleMatch: boolean;
  processMatch: boolean;
  evidence: VerificationEvidenceItem[];
  inconsistencies: string[];
  reasoning: string;
  privacyStatus: PrivacyGate;
  domain: string;
  companyLabel: string;
  evidenceKind: "catalog" | "live_public" | "none";
}
