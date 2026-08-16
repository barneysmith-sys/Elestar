// Shared types for the elestar agent layer.
// These mirror schemas/*.schema.json — keep both in sync.

export type Tier = "apex" | "elite" | "verified" | "standard";
export type Evidence = "self_attested" | "corroborated" | "confirmed" | "flagged";
export type Depth = "mentioned" | "probed" | "assessed";

export type RoundType =
  | "screen" | "technical" | "system_design" | "case"
  | "take_home" | "panel" | "final" | "other";

export type Outcome =
  | "req_closed" | "internal_candidate" | "comp_mismatch"
  | "competitive_loss" | "candidate_withdrew" | "performance" | "unstated";

export interface Round {
  index: number;
  type: RoundType;
  label: string;          // how the candidate described it
  cleared: boolean;
}

export interface Competency {
  name: string;
  depth: Depth;
  roundIndex: number | null;
}

export interface ParsedProcess {
  rounds: Round[];
  roundsCleared: number;
  roundsTotal: number | null;      // null when the loop length was never stated
  roundsConfidence: number;        // 0..1
  processType: "external" | "internal";
  employerProfile: {
    sector: string | null;
    stage: string | null;          // "series_b", "public", "boutique", ...
    sizeBand: string | null;       // "100-500"
    region: string | null;
  };
  loopLengthWeeks: number | null;
  outcome: Outcome;
  competencies: Competency[];
  proposedTier: Tier;
  evidence: Evidence;              // parser only ever emits self_attested | flagged
  needsReview: boolean;
  questions: string[];             // max 3
  notes: string | null;
}

export interface RedactionAudit {
  riskScore: number;               // 0..100
  quasiIdentifiers: { field: string; value: string; contribution: number }[];
  kAnonymity: number;
  decision: "publish" | "generalize" | "withhold";
  generalizations: { field: string; from: string; to: string }[];
  reason: string;                  // shown to the candidate when withheld
}

export interface MatchResult {
  recordId: string;
  fitScore: number;                // 0..100
  components: {
    competencyOverlap: number;
    processSimilarity: number;
    seniorityAlignment: number;
    recency: number;
  };
  matched: string[];
  gaps: string[];
  rationale: string;
}

export interface InterviewBrief {
  alreadyAssessed: { competency: string; depth: Depth; format: string }[];
  safeToSkip: { round: string; redundantWith: string }[];
  probeInstead: string[];
  neverSkip: string[];
  outcomeContext: string;
}

export interface PatternSignal {
  signal: string;
  severity: "low" | "medium" | "high" | "critical";
  evidence: string;
}

export interface PatternReview {
  signals: PatternSignal[];
  recommendation: "clear" | "flag" | "hold";
  reviewerNote: string;
}
