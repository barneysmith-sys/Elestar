export type RoundKind = "screen" | "technical" | "panel" | "final"

export const ROUND_DENSITY: Record<RoundKind, number> = {
  screen: 0.2,
  technical: 0.45,
  panel: 0.7,
  final: 1,
}

export const ROUND_LABEL: Record<RoundKind, string> = {
  screen: "Screen",
  technical: "Technical",
  panel: "Panel",
  final: "Final",
}

export function roundKind(round: string): RoundKind {
  const r = round.toLowerCase()
  if (r.includes("final")) return "final"
  if (r.includes("panel")) return "panel"
  if (
    r.includes("technical") ||
    r.includes("system") ||
    r.includes("challenge") ||
    r.includes("take-home") ||
    r.includes("creative") ||
    r.includes("assignment")
  ) {
    return "technical"
  }
  return "screen"
}

export function publicRoundLabel(round: string) {
  const kind = roundKind(round)
  if (ROUND_LABEL[kind] && /final|panel|technical|screen|portfolio|review/i.test(round)) {
    return ROUND_LABEL[kind]
  }
  const cleaned = round.replace(/\s*\(\d+\/\d+\)\s*/g, "").trim()
  return cleaned || ROUND_LABEL[kind]
}
