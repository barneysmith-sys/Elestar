import { z } from "zod";
import { callJSON, MODELS } from "./client";
import type { MatchResult, ParsedProcess, Depth } from "./types";
import { MATCH_SYSTEM } from "../prompts/match";

export const DEPTH_WEIGHT: Record<Depth, number> = {
  assessed: 1.0,
  probed: 0.5,
  mentioned: 0.15,
};

export function recencyMultiplier(monthsAgo: number): number {
  if (monthsAgo < 3) return 1.0;
  if (monthsAgo < 6) return 0.9;
  if (monthsAgo < 12) return 0.75;
  return 0.5;
}

const MatchZ = z.object({
  results: z.array(z.object({
    recordId: z.string(),
    fitScore: z.number().min(0).max(100),
    components: z.object({
      competencyOverlap: z.number().min(0).max(1),
      processSimilarity: z.number().min(0).max(1),
      seniorityAlignment: z.number().min(0).max(1),
      recency: z.number().min(0).max(1),
    }),
    matched: z.array(z.string()),
    gaps: z.array(z.string()).min(1),   // a rationale with no gap is a sales pitch
    rationale: z.string().max(300),
  })).max(20),
});

/**
 * IMPORTANT: hard filters (tier floor, evidence floor, location, notice,
 * blocklists, the recruiter's own company) are applied in SQL BEFORE this
 * is called. `candidates` must already be a legal result set.
 *
 * A model that can be argued out of a floor can be argued out of a blocklist,
 * and that is a privacy incident rather than a ranking bug.
 */
export async function matchRecords(args: {
  roleDescription: string;
  candidates: { recordId: string; record: ParsedProcess; monthsAgo: number }[];
  limit?: number;
}): Promise<MatchResult[]> {
  if (args.candidates.length === 0) return [];

  const { results } = await callJSON({
    model: MODELS.match,
    system: MATCH_SYSTEM,
    user: JSON.stringify({
      role: args.roleDescription,
      limit: Math.min(args.limit ?? 20, 20),
      depthWeights: DEPTH_WEIGHT,
      candidates: args.candidates.map((c) => ({
        recordId: c.recordId,
        monthsAgo: c.monthsAgo,
        competencies: c.record.competencies,
        rounds: c.record.rounds.map((r) => r.type),
        tier: c.record.proposedTier,
        sector: c.record.employerProfile.sector,
      })),
    }),
    validate: (v) => MatchZ.parse(v),
    maxTokens: 4000,
  });

  return results.sort((a, b) => b.fitScore - a.fitScore);
}
