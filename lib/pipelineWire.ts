/**
 * The wire format of the verification pipeline.
 *
 * Separate from lib/pipeline.ts because that module is `server-only` and the
 * runner view needs these shapes. Every payload here is something the UI
 * animates against: each stage's visual state is driven by a real message
 * from a real state transition, not by a timer pretending to be one.
 *
 * The raw forwarded email never travels on this wire. Mailboxes, headers and
 * signatures stay on the server.
 */

import type { RedactionSpan } from "../src/redact";
import type { ParsedProcess, RedactionAudit, Tier } from "../src/types";
import type { Engine } from "./capabilities";
import type { InboxArrival } from "./ingest/types";
import type { DossierRecord } from "./records";
import type { VerificationResult } from "./verify/types";

export type PipelineStep =
  | "receive"
  | "parse_mail"
  | "identify"
  | "research"
  | "match"
  | "audit"
  | "publish";

export type PipelineStatus = "running" | "ok" | "error" | "blocked";

export const STEP_ORDER: PipelineStep[] = [
  "receive",
  "parse_mail",
  "identify",
  "research",
  "match",
  "audit",
  "publish",
];

export const STEP_TITLE: Record<PipelineStep, string> = {
  receive: "Email received",
  parse_mail: "Parsing interview signals",
  identify: "Identifying company + role",
  research: "Checking public evidence",
  match: "Verifying interview stage",
  audit: "Running privacy audit",
  publish: "Verification complete",
};

export const STEP_ACTIVITY: Record<PipelineStep, string> = {
  receive: "Inbound at prove@elestar.ai…",
  parse_mail: "Reading the forwarded mail for rounds, dates and instructions…",
  identify: "Extracting company domain, role and how far the loop got…",
  research: "Gathering public company and role evidence…",
  match: "Comparing the mail, the stated experience and the public record…",
  audit: "Measuring re-identification risk and cohort size…",
  publish: "Deciding whether the anonymous record can go live…",
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
  simulation: boolean;
  inbox: string;
}

export type PipelineMessage = MetaMessage | StepMessage | QuestionsMessage | DoneMessage;

export interface ReceiveStepData {
  arrival: InboxArrival;
}

export interface ParseMailStepData {
  messageCount: number;
  processSignals: string[];
  lastReachedLabel: string | null;
  interviewDate: string | null;
  extractedRole: string | null;
  fromDomain: string;
  maskedFrom: string;
  subjects: string[];
  removed: { kind: string; count: number }[];
  spans: RedactionSpan[];
  originalLength: number;
}

export interface IdentifyStepData {
  recruiterDomain: string;
  role: string | null;
  lastReachedLabel: string | null;
  processSignals: string[];
  interviewDate: string | null;
  parsed: ParsedProcess;
  tier: Tier;
  ruleTier: Tier;
  roundsCleared: number;
  roundsConfidence: number;
}

export interface ResearchStepData {
  domain: string;
  companyLabel: string;
  found: boolean;
  evidenceKind: "catalog" | "live_public" | "none";
  sector: string | null;
  stage: string | null;
  evidence: VerificationResult["evidence"];
}

export interface MatchStepData {
  domain: string;
  maskedSignal: string;
  verification: VerificationResult;
  structured: {
    company: string;
    role: string | null;
    interview_signal: string | null;
    recruiter_domain: string;
    process_signals: string[];
    evidence: VerificationResult["evidence"];
    confidence: number;
    status: VerificationResult["status"];
  };
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
  published: "Published to the wall",
  pending_review: "Held for human review",
  withheld: "Held private",
  needs_clarification: "Needs clarification",
};
