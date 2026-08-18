/**
 * The wire format of the listing pipeline.
 *
 * Separate from lib/pipeline.ts because that module is `server-only` and the
 * runner view needs these shapes. Every payload here is something the UI
 * animates against, which is the point: each stage's visual state is driven by
 * a real message from a real state transition, not by a timer pretending to be
 * one.
 */

import type { RedactionSpan } from "../src/redact";
import type { ParsedProcess, RedactionAudit, Tier } from "../src/types";
import type { Engine } from "./capabilities";
import type { DossierRecord } from "./records";
import type { VerificationResult } from "./verify/types";

export type PipelineStep = "redact" | "parse" | "tier" | "verify" | "audit" | "publish";
export type PipelineStatus = "running" | "ok" | "error" | "blocked";

export const STEP_ORDER: PipelineStep[] = ["redact", "parse", "tier", "verify", "audit", "publish"];

export const STEP_TITLE: Record<PipelineStep, string> = {
  redact: "Redact",
  parse: "Structure",
  tier: "Tier",
  verify: "Verify",
  audit: "Privacy audit",
  publish: "Publish",
};

/** What the agent is doing while a stage is running. */
export const STEP_ACTIVITY: Record<PipelineStep, string> = {
  redact: "Checking for identifying information…",
  parse: "Reading the process, detecting rounds and competencies…",
  tier: "Applying the deterministic tier rules…",
  verify: "Resolving the recruiter domain and comparing public evidence…",
  audit: "Measuring re-identification risk and cohort size…",
  publish: "Writing the anonymous record…",
};

export interface StepMessage {
  kind: "step";
  step: PipelineStep;
  status: PipelineStatus;
  message: string;
  engine?: Engine;
  trace?: string[];
  data?: unknown;
}

export interface QuestionsMessage {
  kind: "questions";
  questions: string[];
  priorParse: ParsedProcess;
}

export interface DoneMessage {
  kind: "done";
  outcome: "published" | "pending_review" | "withheld" | "needs_clarification";
  dossierId?: string;
  recordId?: string;
  tier?: Tier;
  reason: string;
}

export interface MetaMessage {
  kind: "meta";
  engine: Engine;
  engineLabel: string;
  persistence: boolean;
  persistenceLabel: string;
  authenticated: boolean;
}

export type PipelineMessage = MetaMessage | StepMessage | QuestionsMessage | DoneMessage;

// ---- per-stage payloads ---------------------------------------------------

export interface RedactStepData {
  spans: RedactionSpan[];
  removed: { kind: string; count: number }[];
  originalLength: number;
}

export interface ParseStepData {
  parsed: ParsedProcess;
}

export interface TierStepData {
  tier: Tier;
  ruleTier: Tier;
  roundsCleared: number;
  roundsConfidence: number;
}

export interface VerifyStepData {
  /** Domain only. The mailbox never travels on this payload. */
  domain: string;
  maskedSignal: string;
  verification: VerificationResult;
}

export interface AuditStepData {
  audit: RedactionAudit;
  cohortCount: number;
  kFloor: number;
}

export interface PublishStepData {
  record: DossierRecord;
}

export const OUTCOME_HEADLINE: Record<DoneMessage["outcome"], string> = {
  published: "Published to the Circuit",
  pending_review: "Held for human review",
  withheld: "Held private",
  needs_clarification: "Needs clarification",
};
