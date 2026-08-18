/**
 * Company/domain resolution from a recruiter-email domain.
 *
 * This is a lookup, not an inference: a domain either has a public profile
 * we already know, or it does not. Unknown domains are returned as unknown
 * rather than guessed into a sector — guessing a company from a hostname
 * would be the verification agent inventing the evidence it is supposed to
 * check against.
 *
 * Catalog entries are labelled so the UI can say "catalog" rather than
 * implying a live crawl.
 */

export type EvidenceSourceKind = "catalog" | "live_public";

export interface PublicEvidence {
  id: string;
  kind: EvidenceSourceKind;
  source: string;
  claim: string;
  about: "company" | "role" | "process" | "recruiting";
}

export interface ResolvedCompany {
  domain: string;
  displayName: string;
  sector: string | null;
  stage: string | null;
  sizeBand: string | null;
  region: string | null;
  knownRounds: string[];
  knownRoles: string[];
  evidence: PublicEvidence[];
  found: boolean;
  sourceKind: EvidenceSourceKind;
}

interface CatalogEntry {
  domain: string;
  displayName: string;
  sector: string;
  stage: string;
  sizeBand: string;
  region: string;
  knownRounds: string[];
  knownRoles: string[];
  evidence: Omit<PublicEvidence, "kind">[];
}

/**
 * Public, generalised company profiles used as the demo catalog.
 *
 * These are not customers. They are the public-knowledge shapes a verification
 * agent is allowed to compare a submission against when no live fetch is
 * configured. Every piece of evidence is tagged `catalog` so the UI cannot
 * present it as a live crawl.
 */
const CATALOG: CatalogEntry[] = [
  {
    domain: "ledgerpay.example",
    displayName: "Series B payments company (catalog)",
    sector: "fintech",
    stage: "series_b",
    sizeBand: "100-500",
    region: "north_america",
    knownRounds: ["screen", "technical", "system_design", "final"],
    knownRoles: ["backend engineer", "senior backend", "staff engineer", "payments engineer"],
    evidence: [
      { id: "lp-careers", source: "catalog://ledgerpay.example/careers", claim: "Engineering hiring loop lists recruiter screen, technical interview, system design, final panel.", about: "process" },
      { id: "lp-jd", source: "catalog://ledgerpay.example/jobs/senior-backend", claim: "Open senior backend role emphasises distributed systems and payments infrastructure.", about: "role" },
      { id: "lp-about", source: "catalog://ledgerpay.example/about", claim: "Company describes itself as a Series B payments / fintech firm.", about: "company" },
      { id: "lp-talent", source: "catalog://ledgerpay.example/talent", claim: "Recruiting page uses a company-domain talent@ mailbox.", about: "recruiting" },
    ],
  },
  {
    domain: "northwind-health.example",
    displayName: "Series A healthtech company (catalog)",
    sector: "healthtech",
    stage: "series_a",
    sizeBand: "1-50",
    region: "north_america",
    knownRounds: ["screen", "technical"],
    knownRoles: ["backend engineer", "full stack", "clinical engineer"],
    evidence: [
      { id: "nh-careers", source: "catalog://northwind-health.example/careers", claim: "Hiring process describes a recruiter screen followed by technical interviews.", about: "process" },
      { id: "nh-about", source: "catalog://northwind-health.example/about", claim: "Company describes itself as an early-stage digital health startup.", about: "company" },
      { id: "nh-jd", source: "catalog://northwind-health.example/jobs", claim: "Open roles cluster around full-stack and clinical product engineering.", about: "role" },
    ],
  },
  {
    domain: "vaultkit.example",
    displayName: "Seed-stage crypto custody startup (catalog)",
    sector: "crypto",
    stage: "seed",
    sizeBand: "1-50",
    region: "uk_ireland",
    knownRounds: ["screen", "take_home", "technical", "system_design", "panel", "final"],
    knownRoles: ["head of engineering", "staff engineer", "security engineer"],
    evidence: [
      { id: "vk-about", source: "catalog://vaultkit.example/about", claim: "12-person seed-stage crypto custody team based in Dublin.", about: "company" },
      { id: "vk-loop", source: "catalog://vaultkit.example/hiring", claim: "Loop is described as screen, take-home, technical, system design, panel, final.", about: "process" },
    ],
  },
  {
    domain: "harbor-clinic.example",
    displayName: "Healthcare company (catalog)",
    sector: "healthtech",
    stage: "series_c",
    sizeBand: "500-1000",
    region: "north_america",
    knownRounds: ["screen", "case", "panel"],
    knownRoles: ["product manager", "clinician", "operations"],
    evidence: [
      { id: "hc-about", source: "catalog://harbor-clinic.example/about", claim: "Regional clinic network hiring for clinical and operations roles, not backend engineering.", about: "company" },
      { id: "hc-jobs", source: "catalog://harbor-clinic.example/jobs", claim: "Open roles are product, clinical and operations — no engineering loop is published.", about: "role" },
    ],
  },
];

const byDomain = new Map(CATALOG.map((c) => [c.domain, c]));

export function resolveCompany(domain: string): ResolvedCompany {
  const entry = byDomain.get(domain.toLowerCase());
  if (!entry) {
    return {
      domain,
      displayName: domain,
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
  return {
    domain: entry.domain,
    displayName: entry.displayName,
    sector: entry.sector,
    stage: entry.stage,
    sizeBand: entry.sizeBand,
    region: entry.region,
    knownRounds: entry.knownRounds,
    knownRoles: entry.knownRoles,
    evidence: entry.evidence.map((e) => ({ ...e, kind: "catalog" as const })),
    found: true,
    sourceKind: "catalog",
  };
}

export function collectPublicEvidence(company: ResolvedCompany): PublicEvidence[] {
  return company.evidence;
}
