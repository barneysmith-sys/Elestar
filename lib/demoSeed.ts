import "server-only";

/**
 * Seed records for the demo store.
 *
 * These exist so the Circuit is not empty on first load and so the
 * k-anonymity floor has a real cohort to measure against — an audit that
 * always returns "cohort of 1" would make the privacy model look like
 * theatre when in fact it is the strictest thing in the product.
 *
 * Every record here is synthetic and anonymous by construction. There are no
 * company names, no candidate names, no locations finer than a region, and no
 * outcome that the synthetic description didn't state. `demo: true` travels
 * with each one to the UI, so a seeded record is never presented as a real
 * submission.
 *
 * Cohort note: the audit's floor is k=8 over (tier, region, quarter). The
 * `verified` and `elite` cohorts below are deliberately sized past that floor,
 * because those are the tiers a well-formed submission lands in — under-seeding
 * them would hold every demo submission for a reason that says nothing about
 * the submission, only about how little seed data there is.
 *
 * The floor still has to be visible, so it is left genuinely binding elsewhere:
 * the `apex` cohort is thin, and no seed sits in the `uk_ireland` region, so a
 * narrow record from a small market measures a cohort of zero and is refused.
 */

import type { Competency, Outcome, ParsedProcess, Round, RoundType, Tier } from "../src/types";
import type { DossierRecord } from "./records";
import { recordLabel } from "./recordLabel";

interface SeedSpec {
  slug: string;
  daysAgo: number;
  tier: Tier;
  rounds: [RoundType, string][];
  cleared: number;
  confidence: number;
  sector: string | null;
  stage: string | null;
  sizeBand: string | null;
  region: string | null;
  loopWeeks: number | null;
  outcome: Outcome;
  competencies: [string, Competency["depth"], number | null][];
  riskScore: number;
}

const SPECS: SeedSpec[] = [
  // --- verified cohort: 3 rounds cleared. Sized past the k=8 floor. --------
  {
    slug: "seed-backend-fintech-a", daysAgo: 6, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["final", "Final panel"]],
    cleared: 3, confidence: 0.92,
    sector: "fintech", stage: "series_b", sizeBand: "100-500", region: "north_america",
    loopWeeks: 4, outcome: "competitive_loss",
    competencies: [["Distributed systems", "assessed", 3], ["Algorithms", "assessed", 2], ["Trade-off reasoning", "probed", 3], ["API design", "probed", 2], ["Operational debugging", "mentioned", null]],
    riskScore: 41,
  },
  {
    slug: "seed-backend-saas-b", daysAgo: 11, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["panel", "Panel interview"]],
    cleared: 3, confidence: 0.88,
    sector: "saas", stage: "series_c", sizeBand: "500-1000", region: "north_america",
    loopWeeks: 3, outcome: "req_closed",
    competencies: [["Distributed systems", "assessed", 3], ["Database design", "assessed", 2], ["Communication", "probed", 4], ["Testing discipline", "mentioned", null]],
    riskScore: 38,
  },
  {
    slug: "seed-platform-devtools-c", daysAgo: 14, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["take_home", "Take-home exercise"], ["technical", "Technical interview"], ["final", "Final round"]],
    cleared: 3, confidence: 0.85,
    sector: "devtools", stage: "series_b", sizeBand: "100-500", region: "north_america",
    loopWeeks: 5, outcome: "unstated",
    competencies: [["Applied problem solving", "assessed", 2], ["Infrastructure operations", "assessed", 3], ["Code quality", "probed", 2], ["Concurrency", "mentioned", null]],
    riskScore: 44,
  },
  {
    slug: "seed-data-fintech-d", daysAgo: 19, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["case", "Case study"], ["panel", "Panel interview"]],
    cleared: 3, confidence: 0.83,
    sector: "fintech", stage: "public", sizeBand: "1000+", region: "north_america",
    loopWeeks: 6, outcome: "comp_mismatch",
    competencies: [["Data engineering", "assessed", 2], ["Structured analysis", "assessed", 3], ["Database design", "probed", 2], ["Product judgement", "mentioned", null]],
    riskScore: 29,
  },
  {
    slug: "seed-ml-health-e", daysAgo: 23, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["final", "Final round"]],
    cleared: 3, confidence: 0.79,
    sector: "healthtech", stage: "series_c", sizeBand: "500-1000", region: "north_america",
    loopWeeks: 5, outcome: "internal_candidate",
    competencies: [["Applied ML", "assessed", 2], ["Scalability", "assessed", 3], ["Trade-off reasoning", "probed", 3], ["Security reasoning", "mentioned", null]],
    riskScore: 36,
  },
  {
    slug: "seed-frontend-ecom-f", daysAgo: 28, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["take_home", "Take-home exercise"], ["technical", "Technical interview"], ["panel", "Panel interview"]],
    cleared: 3, confidence: 0.9,
    sector: "ecommerce", stage: "growth", sizeBand: "500-1000", region: "north_america",
    loopWeeks: 3, outcome: "candidate_withdrew",
    competencies: [["Frontend engineering", "assessed", 3], ["Code quality", "assessed", 2], ["Communication", "probed", 4], ["Testing discipline", "mentioned", null]],
    riskScore: 33,
  },
  {
    slug: "seed-security-infra-g", daysAgo: 33, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["final", "Final round"]],
    cleared: 3, confidence: 0.86,
    sector: "security", stage: "series_b", sizeBand: "100-500", region: "north_america",
    loopWeeks: 4, outcome: "unstated",
    competencies: [["Security reasoning", "assessed", 2], ["Distributed systems", "assessed", 3], ["Infrastructure operations", "probed", 3], ["Operational debugging", "mentioned", null]],
    riskScore: 47,
  },
  {
    slug: "seed-backend-market-h", daysAgo: 39, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["case", "Case study"], ["panel", "Panel interview"]],
    cleared: 3, confidence: 0.81,
    sector: "marketplace", stage: "series_d", sizeBand: "1000+", region: "north_america",
    loopWeeks: 4, outcome: "competitive_loss",
    competencies: [["API design", "assessed", 2], ["Structured analysis", "assessed", 3], ["Database design", "probed", 2], ["Product judgement", "mentioned", null]],
    riskScore: 31,
  },
  {
    slug: "seed-backend-europe-i", daysAgo: 44, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["final", "Final round"]],
    cleared: 3, confidence: 0.87,
    sector: "fintech", stage: "series_b", sizeBand: "100-500", region: "europe",
    loopWeeks: 5, outcome: "req_closed",
    competencies: [["Distributed systems", "assessed", 3], ["Algorithms", "assessed", 2], ["Concurrency", "probed", 2], ["Database design", "mentioned", null]],
    riskScore: 42,
  },
  {
    slug: "seed-backend-europe-j", daysAgo: 51, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["take_home", "Take-home exercise"], ["technical", "Technical interview"], ["panel", "Panel interview"]],
    cleared: 3, confidence: 0.84,
    sector: "saas", stage: "series_a", sizeBand: "50-100", region: "europe",
    loopWeeks: 4, outcome: "unstated",
    competencies: [["Applied problem solving", "assessed", 2], ["Code quality", "assessed", 3], ["API design", "probed", 3], ["Testing discipline", "mentioned", null]],
    riskScore: 58,
  },

  // --- elite cohort: 4-5 rounds cleared -----------------------------------
  {
    slug: "seed-staff-saas-k", daysAgo: 9, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["panel", "Panel interview"], ["final", "Final round"]],
    cleared: 4, confidence: 0.93,
    sector: "saas", stage: "series_d", sizeBand: "1000+", region: "north_america",
    loopWeeks: 6, outcome: "competitive_loss",
    competencies: [["Distributed systems", "assessed", 3], ["Engineering leadership", "assessed", 5], ["Scalability", "assessed", 3], ["Trade-off reasoning", "probed", 3], ["Product judgement", "probed", 4]],
    riskScore: 46,
  },
  {
    slug: "seed-staff-ai-l", daysAgo: 17, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["take_home", "Take-home exercise"], ["technical", "Technical interview"], ["system_design", "System design"], ["final", "Final round"]],
    cleared: 4, confidence: 0.89,
    sector: "ai_ml", stage: "series_b", sizeBand: "100-500", region: "north_america",
    loopWeeks: 5, outcome: "unstated",
    competencies: [["Applied ML", "assessed", 3], ["Distributed systems", "assessed", 4], ["Applied problem solving", "assessed", 2], ["Scalability", "probed", 4], ["Engineering leadership", "mentioned", null]],
    riskScore: 52,
  },
  {
    slug: "seed-em-market-m", daysAgo: 26, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["case", "Case study"], ["panel", "Panel interview"], ["system_design", "System design"], ["final", "Final round"]],
    cleared: 4, confidence: 0.82,
    sector: "marketplace", stage: "growth", sizeBand: "500-1000", region: "north_america",
    loopWeeks: 7, outcome: "internal_candidate",
    competencies: [["Engineering leadership", "assessed", 3], ["Structured analysis", "assessed", 2], ["Cross-functional collaboration", "assessed", 3], ["Product judgement", "probed", 2], ["Scalability", "mentioned", null]],
    riskScore: 39,
  },
  {
    slug: "seed-staff-fintech-r", daysAgo: 4, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["panel", "Panel interview"], ["final", "Final round"]],
    cleared: 4, confidence: 0.91,
    sector: "fintech", stage: "series_c", sizeBand: "500-1000", region: "north_america",
    loopWeeks: 5, outcome: "competitive_loss",
    competencies: [["Distributed systems", "assessed", 3], ["Database design", "assessed", 2], ["Scalability", "assessed", 3], ["Trade-off reasoning", "probed", 3], ["Operational debugging", "probed", 4]],
    riskScore: 43,
  },
  {
    slug: "seed-staff-security-s", daysAgo: 13, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["other", "Behavioral interview"], ["final", "Final round"]],
    cleared: 5, confidence: 0.9,
    sector: "security", stage: "series_b", sizeBand: "100-500", region: "north_america",
    loopWeeks: 4, outcome: "comp_mismatch",
    competencies: [["Security reasoning", "assessed", 3], ["Distributed systems", "assessed", 3], ["Threat modelling", "assessed", 2], ["Communication", "probed", 4], ["Engineering leadership", "probed", 5]],
    riskScore: 47,
  },
  {
    slug: "seed-staff-health-t", daysAgo: 20, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["take_home", "Take-home exercise"], ["technical", "Technical interview"], ["panel", "Panel interview"], ["final", "Final round"]],
    cleared: 4, confidence: 0.87,
    sector: "healthtech", stage: "series_c", sizeBand: "500-1000", region: "north_america",
    loopWeeks: 6, outcome: "req_closed",
    competencies: [["Applied problem solving", "assessed", 2], ["Database design", "assessed", 3], ["Regulatory reasoning", "assessed", 4], ["Code quality", "probed", 2], ["Cross-functional collaboration", "probed", 4]],
    riskScore: 51,
  },
  {
    slug: "seed-staff-devtools-u", daysAgo: 27, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["case", "Case study"], ["final", "Final round"]],
    cleared: 4, confidence: 0.86,
    sector: "devtools", stage: "series_b", sizeBand: "100-500", region: "europe",
    loopWeeks: 5, outcome: "unstated",
    competencies: [["Infrastructure operations", "assessed", 3], ["Concurrency", "assessed", 2], ["Distributed systems", "assessed", 3], ["Structured analysis", "probed", 4], ["Trade-off reasoning", "probed", 3]],
    riskScore: 44,
  },
  {
    slug: "seed-staff-saas-v", daysAgo: 34, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["panel", "Panel interview"], ["final", "Final round"]],
    cleared: 5, confidence: 0.93,
    sector: "saas", stage: "growth", sizeBand: "1000+", region: "north_america",
    loopWeeks: 7, outcome: "candidate_withdrew",
    competencies: [["Distributed systems", "assessed", 3], ["Engineering leadership", "assessed", 5], ["API design", "assessed", 2], ["Scalability", "probed", 3], ["Product judgement", "probed", 4]],
    riskScore: 40,
  },
  {
    slug: "seed-staff-market-w", daysAgo: 41, tier: "elite",
    rounds: [["screen", "Recruiter screen"], ["case", "Case study"], ["technical", "Technical interview"], ["system_design", "System design"], ["final", "Final round"]],
    cleared: 4, confidence: 0.84,
    sector: "marketplace", stage: "series_d", sizeBand: "1000+", region: "europe",
    loopWeeks: 6, outcome: "internal_candidate",
    competencies: [["Structured analysis", "assessed", 2], ["Distributed systems", "assessed", 4], ["Algorithms", "assessed", 3], ["Product judgement", "probed", 2], ["Communication", "probed", 5]],
    riskScore: 45,
  },

  // --- standard cohort: 2 rounds ------------------------------------------
  {
    slug: "seed-mid-crypto-n", daysAgo: 21, tier: "standard",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"]],
    cleared: 2, confidence: 0.94,
    sector: "crypto", stage: "seed", sizeBand: "1-50", region: "north_america",
    loopWeeks: 2, outcome: "req_closed",
    competencies: [["Algorithms", "assessed", 2], ["Language fluency", "probed", 2], ["Security reasoning", "mentioned", null]],
    riskScore: 61,
  },
  {
    slug: "seed-mid-edtech-o", daysAgo: 30, tier: "standard",
    rounds: [["screen", "Recruiter screen"], ["take_home", "Take-home exercise"]],
    cleared: 2, confidence: 0.91,
    sector: "edtech", stage: "series_a", sizeBand: "50-100", region: "europe",
    loopWeeks: 2, outcome: "unstated",
    competencies: [["Applied problem solving", "assessed", 2], ["Code quality", "probed", 2], ["Frontend engineering", "mentioned", null]],
    riskScore: 57,
  },

  // --- older records, for recency weighting to have something to discount --
  {
    slug: "seed-apex-public-p", daysAgo: 190, tier: "apex",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["case", "Case study"], ["panel", "Panel interview"], ["final", "Final round"]],
    cleared: 6, confidence: 0.95,
    sector: "fintech", stage: "public", sizeBand: "1000+", region: "north_america",
    loopWeeks: 9, outcome: "comp_mismatch",
    competencies: [["Distributed systems", "assessed", 3], ["Engineering leadership", "assessed", 6], ["Scalability", "assessed", 3], ["Structured analysis", "assessed", 4], ["Trade-off reasoning", "probed", 3], ["Security reasoning", "probed", 3]],
    riskScore: 49,
  },
  {
    slug: "seed-senior-devtools-q", daysAgo: 300, tier: "verified",
    rounds: [["screen", "Recruiter screen"], ["technical", "Technical interview"], ["system_design", "System design"], ["final", "Final round"]],
    cleared: 3, confidence: 0.8,
    sector: "devtools", stage: "series_c", sizeBand: "500-1000", region: "north_america",
    loopWeeks: 4, outcome: "candidate_withdrew",
    competencies: [["Infrastructure operations", "assessed", 3], ["Distributed systems", "assessed", 2], ["Concurrency", "probed", 2], ["Operational debugging", "mentioned", null]],
    riskScore: 35,
  },
];

export const SEED_DOSSIERS: DossierRecord[] = SPECS.map(toDossier);

function toDossier(spec: SeedSpec): DossierRecord {
  const rounds: Round[] = spec.rounds.map(([type, label], i) => ({
    index: i + 1,
    type,
    label,
    cleared: i < spec.cleared,
  }));

  const parsed: ParsedProcess = {
    rounds,
    roundsCleared: spec.cleared,
    roundsTotal: rounds.length,
    roundsConfidence: spec.confidence,
    processType: "external",
    employerProfile: {
      sector: spec.sector,
      stage: spec.stage,
      sizeBand: spec.sizeBand,
      region: spec.region,
    },
    loopLengthWeeks: spec.loopWeeks,
    outcome: spec.outcome,
    competencies: spec.competencies.map(([name, depth, roundIndex]) => ({ name, depth, roundIndex })),
    proposedTier: spec.tier,
    evidence: "self_attested",
    needsReview: false,
    questions: [],
    notes: null,
  };

  return {
    id: recordLabel(spec.slug),
    rowId: spec.slug,
    processId: `${spec.slug}-process`,
    userId: `${spec.slug}-candidate`,
    tier: spec.tier,
    evidence: "self_attested",
    redactionDecision: "publish",
    parsed,
    audit: {
      riskScore: spec.riskScore,
      quasiIdentifiers: [
        ...(spec.stage ? [{ field: "employerProfile.stage", value: spec.stage, contribution: 18 }] : []),
        ...(spec.sector ? [{ field: "employerProfile.sector", value: spec.sector, contribution: 16 }] : []),
        ...(spec.sizeBand ? [{ field: "employerProfile.sizeBand", value: spec.sizeBand, contribution: 22 }] : []),
      ],
      kAnonymity: 8,
      decision: "publish",
      generalizations: [],
      reason: `Cleared the k-anonymity floor at re-identification risk ${spec.riskScore}/100.`,
    },
    createdAt: seedDate(spec.daysAgo),
    demo: true,
  };
}

/**
 * Places a seed record `daysAgo` in the past, but never earlier than the
 * start of the current quarter for records inside the cohort window — the
 * cohort query is quarter-scoped, so a seed that drifts out of the quarter
 * would silently shrink the cohort and change what the demo shows.
 *
 * Records intended to be old (over a quarter) are left where they are, since
 * their job is to give recency weighting something to discount.
 */
function seedDate(daysAgo: number): string {
  const target = new Date(Date.now() - daysAgo * 86_400_000);
  if (daysAgo > 90) return target.toISOString();

  const now = new Date();
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  const floor = quarterStart.getTime() + 86_400_000;
  return new Date(Math.max(target.getTime(), floor)).toISOString();
}
