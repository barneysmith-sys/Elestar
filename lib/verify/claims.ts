/**
 * Claim-level verification. A loop is not a single boolean.
 *
 * Important claims (company, interview occurred, stage) determine whether
 * publication can even be considered. Weaker claims (role, date) can stay
 * uncertain without forcing a verify. Overall confidence is the weakest
 * important claim — never an average that hides a hole.
 */

export type ClaimStatus = "verified" | "probable" | "uncertain" | "contradicted" | "insufficient";

export interface VerificationClaim {
  id: "company" | "interview" | "role" | "stage" | "date" | "identity";
  label: string;
  status: ClaimStatus;
  confidence: number;
  important: boolean;
  evidence: string[];
}

export interface ConfidenceFactors {
  sourceQuality: number;
  independentSources: number;
  agreement: number;
  identity: number;
  recency: number;
  directness: number;
  contradictions: number;
  provenance: number;
  overall: number;
}

export function weakestImportant(claims: VerificationClaim[]): VerificationClaim | null {
  const important = claims.filter((claim) => claim.important);
  if (!important.length) return null;
  return important.reduce((worst, claim) => (claim.confidence < worst.confidence ? claim : worst));
}

export function overallFromClaims(claims: VerificationClaim[], fallback: number): number {
  const worst = weakestImportant(claims);
  if (!worst) return fallback;
  return Number(Math.min(fallback, worst.confidence).toFixed(2));
}

export function emptyFactors(overall = 0): ConfidenceFactors {
  return {
    sourceQuality: 0,
    independentSources: 0,
    agreement: 0,
    identity: 0,
    recency: 0.5,
    directness: 0,
    contradictions: 1,
    provenance: 0,
    overall,
  };
}

export function buildClaims(args: {
  found: boolean;
  companyMatch: boolean;
  roleMatch: boolean;
  processMatch: boolean;
  stageSupported: boolean;
  stageClash: boolean;
  evidenceCount: number;
  independentSources: number;
  hasMail: boolean;
  hasDate: boolean;
  inconsistencies: string[];
}): { claims: VerificationClaim[]; factors: ConfidenceFactors } {
  const catalogQuality = args.found ? 0.75 : 0.15;
  const mailQuality = args.hasMail ? 0.85 : 0.2;
  const sourceQuality = Math.max(catalogQuality, mailQuality);
  const independent = Math.min(1, args.independentSources / 2);
  const agreement = args.inconsistencies.length === 0 ? 1 : args.stageClash || !args.companyMatch ? 0.1 : 0.4;
  const identity = args.found && args.companyMatch ? 0.9 : args.found ? 0.35 : 0.15;
  const recency = 0.7;
  const directness = args.hasMail ? 0.85 : 0.4;
  const contradictions = args.inconsistencies.length === 0 ? 0 : args.stageClash || !args.companyMatch ? 1 : 0.6;
  const provenance = args.evidenceCount > 0 && args.hasMail ? 0.85 : args.evidenceCount > 0 || args.hasMail ? 0.55 : 0.2;

  const companyStatus: ClaimStatus = !args.found
    ? "insufficient"
    : !args.companyMatch
      ? "contradicted"
      : "verified";
  const interviewStatus: ClaimStatus = args.hasMail || args.processMatch ? "verified" : "insufficient";
  const roleStatus: ClaimStatus = args.roleMatch ? "probable" : args.found ? "uncertain" : "insufficient";
  const stageStatus: ClaimStatus = args.stageClash ? "contradicted" : args.stageSupported ? "verified" : "uncertain";
  const dateStatus: ClaimStatus = args.hasDate ? "probable" : "uncertain";

  const claims: VerificationClaim[] = [
    {
      id: "company",
      label: "Company identity",
      status: companyStatus,
      confidence: companyStatus === "verified" ? identity : companyStatus === "contradicted" ? 0.15 : 0.2,
      important: true,
      evidence: args.found ? ["catalog"] : [],
    },
    {
      id: "interview",
      label: "Interview occurred",
      status: interviewStatus,
      confidence: interviewStatus === "verified" ? Math.max(mailQuality, args.processMatch ? 0.7 : 0.5) : 0.2,
      important: true,
      evidence: args.hasMail ? ["forwarded-mail"] : [],
    },
    {
      id: "role",
      label: "Role",
      status: roleStatus,
      confidence: roleStatus === "probable" ? 0.75 : roleStatus === "uncertain" ? 0.45 : 0.2,
      important: false,
      evidence: args.roleMatch ? ["catalog", "submission"] : [],
    },
    {
      id: "stage",
      label: "How far the loop got",
      status: stageStatus,
      confidence: stageStatus === "verified" ? 0.86 : stageStatus === "contradicted" ? 0.2 : 0.4,
      important: true,
      evidence: args.hasMail ? ["forwarded-mail"] : [],
    },
    {
      id: "date",
      label: "Interview date",
      status: dateStatus,
      confidence: dateStatus === "probable" ? 0.6 : 0.3,
      important: false,
      evidence: args.hasDate ? ["forwarded-mail"] : [],
    },
    {
      id: "identity",
      label: "Candidate identity",
      status: "insufficient",
      confidence: 0,
      important: false,
      evidence: [],
    },
  ];

  const overall = overallFromClaims(claims, Number((
    0.25 * sourceQuality +
    0.15 * independent +
    0.2 * agreement +
    0.2 * identity +
    0.05 * recency +
    0.1 * directness +
    0.05 * (1 - contradictions)
  ).toFixed(2)));

  return {
    claims,
    factors: {
      sourceQuality: Number(sourceQuality.toFixed(2)),
      independentSources: args.independentSources,
      agreement: Number(agreement.toFixed(2)),
      identity: Number(identity.toFixed(2)),
      recency,
      directness: Number(directness.toFixed(2)),
      contradictions: Number(contradictions.toFixed(2)),
      provenance: Number(provenance.toFixed(2)),
      overall,
    },
  };
}
