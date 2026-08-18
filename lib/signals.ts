/**
 * Aggregate intelligence over published interview records.
 *
 * Signals is the layer above Circuit: Circuit is one anonymised loop,
 * Signals is what the pool is teaching. Every number here is counted from
 * records that already cleared publication — unpublished, withheld, and
 * flagged rows are not in the set.
 *
 * Company names are not an input. The closest public grain is the generalised
 * employer profile (sector / stage). Filters that look like "company" are
 * sector filters, labelled that way so we do not pretend we retained a brand.
 */

import type { DossierRecord } from "./records";
import type { RoundType } from "../src/types";

export interface SignalsFilter {
  sector?: string;
  stage?: string;
  round?: string;
  competency?: string;
  /** Inclusive lookback. 0 / undefined means all time. */
  days?: number;
  /** When true, drop demo seeds. */
  excludeDemo?: boolean;
}

export interface NamedShare {
  name: string;
  count: number;
  share: number;
}

export interface TrendingClaim {
  id: string;
  claim: string;
  basis: string;
  share: number | null;
  count: number;
}

export interface SignalsReport {
  pool: number;
  published: number;
  demoCount: number;
  corroborated: number;
  filters: SignalsFilter;
  competencies: NamedShare[];
  rounds: NamedShare[];
  sectors: NamedShare[];
  stages: NamedShare[];
  medianLoopWeeks: number | null;
  meanRounds: number | null;
  trending: TrendingClaim[];
  eligible: boolean;
}

const EMPTY: SignalsReport = {
  pool: 0,
  published: 0,
  demoCount: 0,
  corroborated: 0,
  filters: {},
  competencies: [],
  rounds: [],
  sectors: [],
  stages: [],
  medianLoopWeeks: null,
  meanRounds: null,
  trending: [],
  eligible: false,
};

export function filterSignalRecords(records: DossierRecord[], filter: SignalsFilter = {}): DossierRecord[] {
  const published = records.filter((r) => r.redactionDecision === "publish");
  return published.filter((r) => {
    if (filter.excludeDemo && r.demo) return false;
    if (filter.sector && r.parsed.employerProfile.sector !== filter.sector) return false;
    if (filter.stage && r.parsed.employerProfile.stage !== filter.stage) return false;
    if (filter.round && !r.parsed.rounds.some((round) => round.type === filter.round)) return false;
    if (filter.competency && !r.parsed.competencies.some((c) => c.name === filter.competency)) return false;
    if (filter.days && filter.days > 0) {
      const cutoff = Date.now() - filter.days * 86_400_000;
      if (new Date(r.createdAt).getTime() < cutoff) return false;
    }
    return true;
  });
}

export function aggregateSignals(records: DossierRecord[], filter: SignalsFilter = {}): SignalsReport {
  const published = records.filter((r) => r.redactionDecision === "publish");
  const pool = filterSignalRecords(records, filter);
  if (pool.length === 0) {
    return { ...EMPTY, published: published.length, filters: filter, eligible: false };
  }

  const competencies = share(
    pool.flatMap((r) => r.parsed.competencies.map((c) => c.name)),
    pool.length,
  );
  const rounds = share(
    pool.flatMap((r) => r.parsed.rounds.map((round) => round.type)),
    pool.length,
  );
  const sectors = share(
    pool.map((r) => r.parsed.employerProfile.sector).filter((s): s is string => Boolean(s)),
    pool.length,
  );
  const stages = share(
    pool.map((r) => r.parsed.employerProfile.stage).filter((s): s is string => Boolean(s)),
    pool.length,
  );

  const weeks = pool
    .map((r) => r.parsed.loopLengthWeeks)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  const medianLoopWeeks = weeks.length ? weeks[Math.floor(weeks.length / 2)]! : null;
  const meanRounds = pool.reduce((n, r) => n + r.parsed.rounds.length, 0) / pool.length;

  return {
    pool: pool.length,
    published: published.length,
    demoCount: pool.filter((r) => r.demo).length,
    corroborated: pool.filter((r) => r.evidence === "corroborated" || r.evidence === "confirmed").length,
    filters: filter,
    competencies,
    rounds,
    sectors,
    stages,
    medianLoopWeeks,
    meanRounds: Number(meanRounds.toFixed(2)),
    trending: trendingClaims(pool, competencies, rounds, medianLoopWeeks),
    eligible: true,
  };
}

function share(values: string[], denom: number): NamedShare[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, share: count / denom }))
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
}

function trendingClaims(
  pool: DossierRecord[],
  competencies: NamedShare[],
  rounds: NamedShare[],
  medianLoopWeeks: number | null,
): TrendingClaim[] {
  const claims: TrendingClaim[] = [];
  const n = pool.length;

  const topComp = competencies[0];
  if (topComp && topComp.share >= 0.2) {
    claims.push({
      id: "top-competency",
      claim: `${topComp.name} appears in ${pct(topComp.share)} of verified loops in this view.`,
      basis: `${topComp.count} of ${n} published records name it.`,
      share: topComp.share,
      count: topComp.count,
    });
  }

  const assessed = pool.filter((r) => r.parsed.competencies.some((c) => c.depth === "assessed"));
  if (assessed.length > 0) {
    claims.push({
      id: "assessed-depth",
      claim: `${pct(assessed.length / n)} of loops assessed at least one competency rather than only mentioning it.`,
      basis: "Depth is taken from the structured record, not inferred from a job description.",
      share: assessed.length / n,
      count: assessed.length,
    });
  }

  const final = rounds.find((r) => r.name === "final");
  if (final) {
    claims.push({
      id: "final-round",
      claim: `A final round appears in ${pct(final.share)} of loops.`,
      basis: `${final.count} of ${n} published records named a final / exec stage.`,
      share: final.share,
      count: final.count,
    });
  }

  const behavioral = pool.filter((r) => r.parsed.rounds.some((round) => round.type === "other"));
  if (behavioral.length > 0) {
    const early = behavioral.filter((r) => {
      const idx = r.parsed.rounds.find((round) => round.type === "other")?.index ?? 99;
      return idx <= 2;
    });
    claims.push({
      id: "behavioral-timing",
      claim:
        early.length / behavioral.length >= 0.5
          ? `When a behavioral round is present, it is in the first two stages ${pct(early.length / behavioral.length)} of the time.`
          : `Behavioral rounds appear in ${pct(behavioral.length / n)} of loops, usually later in the sequence.`,
      basis: `${behavioral.length} loops named a behavioral / values round.`,
      share: behavioral.length / n,
      count: behavioral.length,
    });
  }

  const xf = pool.filter((r) =>
    r.parsed.competencies.some((c) => /cross-functional|collaboration|communication/i.test(c.name)),
  );
  const xfFinal = xf.filter((r) => r.parsed.rounds.some((round) => round.type === "final" || round.type === "panel"));
  if (xf.length > 0) {
    claims.push({
      id: "cross-functional",
      claim: `Cross-functional or communication signal shows up in ${pct(xf.length / n)} of loops${
        xfFinal.length > 0 ? `, and ${pct(xfFinal.length / xf.length)} of those also ran a panel or final.` : "."
      }`,
      basis: "Counted from competency names on published records.",
      share: xf.length / n,
      count: xf.length,
    });
  }

  if (medianLoopWeeks !== null) {
    claims.push({
      id: "loop-length",
      claim: `Median process length is ${medianLoopWeeks} week${medianLoopWeeks === 1 ? "" : "s"}.`,
      basis: "Only records that stated a loop length are included in the median.",
      share: null,
      count: pool.filter((r) => r.parsed.loopLengthWeeks !== null).length,
    });
  }

  const recentCutoff = Date.now() - 45 * 86_400_000;
  const recent = pool.filter((r) => new Date(r.createdAt).getTime() >= recentCutoff);
  const older = pool.filter((r) => new Date(r.createdAt).getTime() < recentCutoff);
  if (recent.length >= 4 && older.length >= 4) {
    const recentPanel = shareOfType(recent, "panel");
    const olderPanel = shareOfType(older, "panel");
    if (Math.abs(recentPanel - olderPanel) >= 0.08) {
      claims.push({
        id: "panel-shift",
        claim:
          recentPanel > olderPanel
            ? `Panel / onsite rounds are more common in the last 45 days (${pct(recentPanel)} vs ${pct(olderPanel)} earlier).`
            : `Panel / onsite rounds are less common in the last 45 days (${pct(recentPanel)} vs ${pct(olderPanel)} earlier).`,
        basis: "Same published pool, split on record createdAt. Demo seeds use synthetic dates.",
        share: recentPanel,
        count: recent.length,
      });
    }
  }

  return claims.slice(0, 8);
}

function shareOfType(records: DossierRecord[], type: RoundType): number {
  if (records.length === 0) return 0;
  return records.filter((r) => r.parsed.rounds.some((round) => round.type === type)).length / records.length;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function parseSignalsFilter(input: {
  sector?: string;
  stage?: string;
  round?: string;
  competency?: string;
  days?: string | number;
  excludeDemo?: string | boolean;
}): SignalsFilter {
  const daysRaw = typeof input.days === "string" ? Number.parseInt(input.days, 10) : input.days;
  return {
    sector: emptyToUndef(input.sector),
    stage: emptyToUndef(input.stage),
    round: emptyToUndef(input.round),
    competency: emptyToUndef(input.competency),
    days: Number.isFinite(daysRaw) && (daysRaw as number) > 0 ? (daysRaw as number) : undefined,
    excludeDemo: input.excludeDemo === true || input.excludeDemo === "true",
  };
}

function emptyToUndef(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
