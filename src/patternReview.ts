import { z } from "zod";
import { callJSON, MODELS } from "./client";
import type { ParsedProcess, PatternReview } from "./types";
import { PATTERN_SYSTEM } from "../prompts/pattern";

const ReviewZ = z.object({
  signals: z.array(z.object({
    signal: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    evidence: z.string().max(300),
  })),
  recommendation: z.enum(["clear", "flag", "hold"]),
  reviewerNote: z.string().max(500),
});

/**
 * Batch only — never on the write path.
 * Never auto-rejects. Every non-clear result becomes a human queue item.
 */
export async function reviewPattern(args: {
  recordId: string;
  record: ParsedProcess;
  rawDescription: string;
  candidateOtherRecords: ParsedProcess[];
  employerNorms: {
    medianRounds: number | null;
    commonStructures: string[][];
    sampleSize: number;
  };
  nearDuplicateScore: number;    // 0..1, precomputed by embedding similarity
}): Promise<PatternReview> {
  return callJSON({
    model: MODELS.pattern,
    system: PATTERN_SYSTEM,
    user: JSON.stringify(args),
    validate: (v) => ReviewZ.parse(v),
  });
}

/** Sweep health check. Above 2% held, the thresholds are wrong. */
export function sweepHoldRate(results: PatternReview[]): number {
  if (!results.length) return 0;
  return results.filter((r) => r.recommendation === "hold").length / results.length;
}
