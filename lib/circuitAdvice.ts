/**
 * Hire-side advice taken only from a published record.
 * Never invents a round or competency that is not already on the dossier.
 */

import type { ParsedProcess } from "../src/types";
import { ROUND_LABEL } from "./records";

export interface CircuitAdvice {
  alreadySampled: string[];
  assessed: string[];
  stillUnknown: string[];
  neverSkip: string[];
}

export function circuitAdvice(parsed: ParsedProcess): CircuitAdvice {
  const alreadySampled = parsed.rounds
    .filter((round) => round.cleared)
    .map((round) => ROUND_LABEL[round.type] ?? round.label);
  const assessed = parsed.competencies
    .filter((c) => c.depth === "assessed" || c.depth === "probed")
    .map((c) => c.name);
  const stillUnknown = parsed.competencies.filter((c) => c.depth === "mentioned").map((c) => c.name);
  return {
    alreadySampled,
    assessed,
    stillUnknown,
    neverSkip: ["Team chemistry — no external loop can measure fit with your people."],
  };
}
