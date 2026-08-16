import { z } from "zod";
import { callJSON, MODELS } from "./client";
import type { ParsedProcess, RedactionAudit } from "./types";
import { REDACTION_SYSTEM } from "../prompts/redaction";

export const K_FLOOR = 8;

const AuditZ = z.object({
  riskScore: z.number().min(0).max(100),
  quasiIdentifiers: z.array(z.object({
    field: z.string(), value: z.string(), contribution: z.number().min(0).max(100),
  })),
  kAnonymity: z.number().int().min(0),
  decision: z.enum(["publish", "generalize", "withhold"]),
  generalizations: z.array(z.object({
    field: z.string(), from: z.string(), to: z.string(),
  })),
  reason: z.string().max(400),
});

/**
 * Fails CLOSED. Any error, timeout or validation failure returns `withhold`.
 * An unpublished record is an annoyed candidate; a wrongly published one
 * is the end of the product.
 */
export async function auditRedaction(args: {
  record: ParsedProcess;
  poolCohortCount: number;  // live records sharing (tier band, function, seniority band, region, quarter)
}): Promise<RedactionAudit> {
  try {
    const audit = await callJSON({
      model: MODELS.redaction,
      system: REDACTION_SYSTEM,
      user: JSON.stringify({
        record: args.record,
        cohortCount: args.poolCohortCount,
        kFloor: K_FLOOR,
      }),
      validate: (v) => AuditZ.parse(v),
    });

    // Hard floor overrides whatever the model concluded.
    if (args.poolCohortCount < K_FLOOR && audit.decision === "publish") {
      return { ...audit, decision: "generalize" };
    }
    return audit;
  } catch {
    return {
      riskScore: 100,
      quasiIdentifiers: [],
      kAnonymity: 0,
      decision: "withhold",
      generalizations: [],
      reason:
        "We could not confirm this record is anonymous enough to publish yet. " +
        "It stays private until we can. Nothing has been shared.",
    };
  }
}
