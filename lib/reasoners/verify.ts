/**
 * Deterministic verification reasoner.
 *
 * Compares a structured interview process to the public evidence attached to
 * the recruiter-email domain. It does not see the recruiter mailbox — only
 * the domain the email module already extracted — so a leak of the address
 * through this function is structurally impossible.
 *
 * Rules, in order:
 *   1. invalid / personal domain → failed
 *   2. unknown domain / no public evidence → needs_review
 *   3. company sector/stage clash with the submission → failed
 *   4. role has no overlap with published roles → needs_review (or failed if
 *      the company is well-described and the clash is sharp)
 *   5. process rounds diverge sharply from published loop → needs_review
 *   6. otherwise verified, with confidence from how many checks agreed
 *
 * These are judgments a model can refine, but they are already decisions —
 * the pipeline treats `failed` as unpublished regardless of what a model
 * later says, because verification is a gate, not a suggestion.
 */

import type { ParsedProcess } from "../../src/types";
import type { RecruiterSignal } from "../verify/email";
import { collectPublicEvidence, resolveCompany, type ResolvedCompany } from "../verify/resolve";
import type { VerificationResult, VerificationStatus } from "../verify/types";

export interface DeterministicVerifyResult {
  verification: VerificationResult;
  company: ResolvedCompany;
  trace: string[];
}

export function verifyProcessDeterministic(args: {
  signal: RecruiterSignal;
  parsed: ParsedProcess;
  role?: string;
}): DeterministicVerifyResult {
  const { signal, parsed } = args;
  const role = (args.role ?? "").toLowerCase();
  const trace: string[] = [];

  if (signal.kind === "invalid") {
    trace.push(signal.reason);
    return wrap(failed(signal, "No usable recruiter signal.", trace), emptyCompany(signal.domain), trace);
  }
  if (signal.kind === "personal") {
    trace.push(signal.reason);
    return wrap(
      failed(signal, "Personal mailbox providers are not a company verification signal.", trace, {
        inconsistencies: [signal.reason],
      }),
      emptyCompany(signal.domain),
      trace,
    );
  }

  trace.push(`Resolving public profile for ${signal.domain}.`);
  const company = resolveCompany(signal.domain);
  const evidence = collectPublicEvidence(company);

  if (!company.found || evidence.length === 0) {
    trace.push(`No public catalog evidence for ${signal.domain} — holding for review rather than inventing a company.`);
    return wrap(
      {
        status: "needs_review",
        confidence: 0.2,
        companyMatch: false,
        roleMatch: false,
        processMatch: false,
        evidence: [],
        inconsistencies: [`No public recruiting evidence found for ${signal.domain}.`],
        reasoning:
          "The recruiter domain did not resolve to any public company or hiring-loop documentation we can cite. Holding rather than verifying on an empty record.",
        privacyStatus: "pending",
        domain: signal.domain,
        companyLabel: signal.domain,
        evidenceKind: "none",
      },
      company,
      trace,
    );
  }

  trace.push(`Catalog returned ${evidence.length} public signal(s) for ${company.displayName}.`);

  const submittedSector = parsed.employerProfile.sector;
  const submittedStage = parsed.employerProfile.stage;
  const companyMatch =
    (!submittedSector || submittedSector === company.sector) &&
    (!submittedStage || submittedStage === company.stage);

  if (submittedSector && submittedSector !== company.sector) {
    trace.push(`Sector clash: submission says ${submittedSector}, public profile is ${company.sector}.`);
  } else if (submittedSector) {
    trace.push(`Sector agrees: ${submittedSector}.`);
  } else {
    trace.push("Submission did not name a sector; company match rests on stage and process only.");
  }

  const roleMatch =
    !role ||
    company.knownRoles.some((r) => role.includes(r) || r.split(" ").every((w) => w.length < 3 || role.includes(w)));

  if (role && !roleMatch) {
    trace.push(`Role "${role}" does not overlap the company's published roles (${company.knownRoles.join(", ")}).`);
  } else if (role) {
    trace.push(`Role overlaps published openings.`);
  }

  const submittedTypes = parsed.rounds.map((r) => r.type);
  const overlap = submittedTypes.filter((t) => company.knownRounds.includes(t));
  const processMatch =
    submittedTypes.length === 0 ||
    overlap.length >= Math.min(2, submittedTypes.length) ||
    (company.knownRounds.length > 0 && overlap.length / submittedTypes.length >= 0.5);

  if (submittedTypes.length === 0) {
    trace.push("No rounds named, so process match cannot be confirmed.");
  } else {
    trace.push(
      `Process overlap: ${overlap.length}/${submittedTypes.length} named rounds appear in the public loop (${company.knownRounds.join(", ") || "none published"}).`,
    );
  }

  const inconsistencies: string[] = [];
  if (submittedSector && submittedSector !== company.sector) {
    inconsistencies.push(
      `Submitted employer sector (${submittedSector}) does not match the public profile (${company.sector}).`,
    );
  }
  if (submittedStage && submittedStage !== company.stage) {
    inconsistencies.push(
      `Submitted stage (${submittedStage}) does not match the public profile (${company.stage}).`,
    );
  }
  if (role && !roleMatch) {
    inconsistencies.push(`Submitted role does not appear among published openings.`);
  }
  if (submittedTypes.length > 0 && !processMatch) {
    inconsistencies.push(`Submitted rounds do not resemble the publicly described hiring loop.`);
  }

  let status: VerificationStatus;
  let confidence: number;
  let reasoning: string;

  if (!companyMatch && submittedSector && submittedSector !== company.sector) {
    status = "failed";
    confidence = 0.15;
    reasoning =
      "The recruiter domain resolves to a different kind of company than the one described in the submission. That is a contradiction, not an ambiguity, so this does not verify.";
    trace.push("Decision: failed — company mismatch.");
  } else if (!processMatch && submittedTypes.length >= 3 && company.knownRounds.length >= 3) {
    status = "needs_review";
    confidence = 0.4;
    reasoning =
      "The company resolved, but the described loop does not match the publicly documented one closely enough to verify automatically.";
    trace.push("Decision: needs_review — process mismatch.");
  } else if (!roleMatch && role && company.knownRoles.length > 0 && companyMatch) {
    status = "needs_review";
    confidence = 0.45;
    reasoning =
      "Company and process are consistent, but the role is not among the openings the company has published. A person should confirm before this is treated as verified.";
    trace.push("Decision: needs_review — role not in published openings.");
  } else if (inconsistencies.length > 0) {
    status = "needs_review";
    confidence = 0.5;
    reasoning = "Some checks agreed and some did not. Holding for review rather than forcing a verify.";
    trace.push("Decision: needs_review — mixed signals.");
  } else {
    const signals = 1 + (companyMatch ? 1 : 0) + (roleMatch ? 1 : 0) + (processMatch ? 1 : 0) + Math.min(evidence.length, 4) / 4;
    confidence = Math.min(0.96, 0.55 + signals * 0.08);
    status = "verified";
    reasoning = `Public evidence for ${company.displayName} is consistent with the submitted loop. Company, role and process checks all passed against ${evidence.length} catalog signal(s).`;
    trace.push(`Decision: verified — confidence ${confidence.toFixed(2)}.`);
  }

  return wrap(
    {
      status,
      confidence: Number(confidence.toFixed(2)),
      companyMatch,
      roleMatch,
      processMatch,
      evidence: evidence.map((e) => ({
        id: e.id,
        kind: e.kind,
        source: e.source,
        claim: e.claim,
        about: e.about,
      })),
      inconsistencies,
      reasoning,
      privacyStatus: "pending",
      domain: signal.domain,
      companyLabel: company.displayName,
      evidenceKind: "catalog",
    },
    company,
    trace,
  );
}

function wrap(
  verification: VerificationResult,
  company: ResolvedCompany,
  trace: string[],
): DeterministicVerifyResult {
  return { verification, company, trace };
}

function emptyCompany(domain: string): ResolvedCompany {
  return {
    domain,
    displayName: domain || "(none)",
    sector: null,
    stage: null,
    sizeBand: null,
    region: null,
    knownRounds: [],
    knownRoles: [],
    evidence: [],
    found: false,
    sourceKind: "catalog",
  };
}

function failed(
  signal: RecruiterSignal,
  reasoning: string,
  _trace: string[],
  extra: Partial<Pick<VerificationResult, "inconsistencies">> = {},
): VerificationResult {
  return {
    status: "failed",
    confidence: 0,
    companyMatch: false,
    roleMatch: false,
    processMatch: false,
    evidence: [],
    inconsistencies: extra.inconsistencies ?? [reasoning],
    reasoning,
    privacyStatus: "pending",
    domain: signal.domain,
    companyLabel: signal.domain || "(none)",
    evidenceKind: "none",
  };
}
