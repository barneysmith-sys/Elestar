import { z } from "zod";
import { callJSON, MODELS } from "./client";
import { redact, assertRedacted } from "./redact";
import type { ParsedProcess, Tier } from "./types";
import { PARSE_SYSTEM } from "../prompts/parse";

const RoundZ = z.object({
  index: z.number().int().min(1),
  type: z.enum(["screen","technical","system_design","case","take_home","panel","final","other"]),
  label: z.string().max(120),
  cleared: z.boolean(),
});

export const ParsedProcessZ = z.object({
  rounds: z.array(RoundZ).max(15),
  roundsCleared: z.number().int().min(0).max(15),
  roundsTotal: z.number().int().min(0).max(15).nullable(),
  roundsConfidence: z.number().min(0).max(1),
  processType: z.enum(["external", "internal"]),
  employerProfile: z.object({
    sector: z.string().nullable(),
    stage: z.string().nullable(),
    sizeBand: z.string().nullable(),
    region: z.string().nullable(),
  }),
  loopLengthWeeks: z.number().min(0).max(52).nullable(),
  outcome: z.enum([
    "req_closed","internal_candidate","comp_mismatch",
    "competitive_loss","candidate_withdrew","performance","unstated",
  ]),
  competencies: z.array(z.object({
    name: z.string().max(60),
    depth: z.enum(["mentioned", "probed", "assessed"]),
    roundIndex: z.number().int().nullable(),
  })).max(8),
  proposedTier: z.enum(["apex", "elite", "verified", "standard"]),
  needsReview: z.boolean(),
  questions: z.array(z.string().max(160)).max(3),
  notes: z.string().max(400).nullable(),
});

const ORDER: Tier[] = ["standard", "verified", "elite", "apex"];

/**
 * Deterministic tier. Authoritative — the model's proposal is advisory and
 * may lower this but never raise it.
 *
 * Rules, in order:
 *  1. rounds cleared is primary
 *  2. a KNOWN offer rate may promote by at most one tier
 *  3. loop length may only demote
 *  4. roundsConfidence < 0.6 caps at verified
 *  5. brand never promotes — it is not an input here, deliberately
 */
export function computeTier(input: {
  roundsCleared: number;
  roundsConfidence: number;
  loopLengthWeeks: number | null;
  knownOfferRate: number | null;
}): Tier {
  const { roundsCleared, roundsConfidence, loopLengthWeeks, knownOfferRate } = input;

  let tier: Tier =
    roundsCleared >= 6 ? "apex" :
    roundsCleared >= 4 ? "elite" :
    roundsCleared === 3 ? "verified" : "standard";

  if (knownOfferRate !== null) {
    const byRate: Tier =
      knownOfferRate < 0.02 ? "apex" :
      knownOfferRate < 0.08 ? "elite" :
      knownOfferRate < 0.20 ? "verified" : "standard";
    if (ORDER.indexOf(byRate) > ORDER.indexOf(tier)) {
      tier = ORDER[Math.min(ORDER.indexOf(tier) + 1, ORDER.length - 1)]; // at most one step
    }
  }

  // A 6-round loop that resolved in under two weeks is usually a miscount.
  if (loopLengthWeeks !== null && loopLengthWeeks < 2 && roundsCleared >= 6) {
    tier = ORDER[Math.max(ORDER.indexOf(tier) - 1, 0)];
  }

  if (roundsConfidence < 0.6 && ORDER.indexOf(tier) > ORDER.indexOf("verified")) {
    tier = "verified";
  }

  return tier;
}

export async function parseProcess(args: {
  description: string;
  knownNames?: string[];
  knownOfferRate?: number | null;
  priorAnswers?: Record<string, string>;
}): Promise<ParsedProcess> {
  const { text } = redact(args.description, { knownNames: args.knownNames });
  assertRedacted(text);

  const user = [
    "<description>", text, "</description>",
    args.priorAnswers && Object.keys(args.priorAnswers).length
      ? `<clarifications>${JSON.stringify(args.priorAnswers)}</clarifications>`
      : "",
    "Return only the JSON object.",
  ].filter(Boolean).join("\n");

  const raw = await callJSON({
    model: MODELS.parse,
    system: PARSE_SYSTEM,
    user,
    validate: (v) => ParsedProcessZ.parse(v),
  });

  const ruleTier = computeTier({
    roundsCleared: raw.roundsCleared,
    roundsConfidence: raw.roundsConfidence,
    loopLengthWeeks: raw.loopLengthWeeks,
    knownOfferRate: args.knownOfferRate ?? null,
  });

  const disagreement = Math.abs(ORDER.indexOf(ruleTier) - ORDER.indexOf(raw.proposedTier));

  return {
    ...raw,
    // rules may lower, never raise
    proposedTier: ORDER.indexOf(raw.proposedTier) < ORDER.indexOf(ruleTier)
      ? raw.proposedTier
      : ruleTier,
    evidence: "self_attested",
    needsReview: raw.needsReview || disagreement > 1,
  };
}
