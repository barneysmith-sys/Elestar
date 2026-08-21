/**
 * Product-level captions for Verify and Agent Lab.
 *
 * These are labels a recruiter or candidate can read. They must never echo
 * hidden reasoning or untrusted instruction text from inbound mail.
 */

import type { DoneMessage, PipelineStep, StepMessage } from "./pipelineWire";
import type { AuditStepData, IdentifyStepData, MatchStepData, PlanStepData, ResearchStepData } from "./pipelineWire";

export const HERO_RAIL: { step: PipelineStep; label: string }[] = [
  { step: "receive", label: "Received" },
  { step: "identify", label: "Identified" },
  { step: "plan", label: "Planned" },
  { step: "research", label: "Researching" },
  { step: "match", label: "Verifying" },
  { step: "audit", label: "Privacy check" },
  { step: "publish", label: "Decision" },
  { step: "place", label: "Circuit" },
];

export type OutcomeStamp =
  | "VERIFIED"
  | "HELD"
  | "IDENTITY UNCERTAIN"
  | "INSUFFICIENT EVIDENCE"
  | "CONFLICT DETECTED"
  | "PRIVACY BLOCKED"
  | "TOOL FAILURE"
  | "MODEL FAILURE"
  | "NEEDS CLARIFICATION";

export function productCaption(step: PipelineStep, message: StepMessage | undefined): string {
  if (!message) return "";
  const data = message.data;
  switch (step) {
    case "receive":
      return message.message;
    case "parse_mail": {
      const d = data as { lastReachedLabel?: string | null; auth?: { sealHolds?: boolean; summary?: string } } | undefined;
      if (d?.auth?.sealHolds) return `Seal holds · ${d.lastReachedLabel ?? "rounds parsed"}`;
      if (d?.auth?.summary) return d.auth.summary;
      return message.message;
    }
    case "identify": {
      const d = data as IdentifyStepData | undefined;
      if (!d?.recruiterDomain) return "No company domain on the mail";
      return d.role ? `Role ${d.role} · ${d.recruiterDomain}` : `Domain ${d.recruiterDomain}`;
    }
    case "plan": {
      const d = data as PlanStepData | undefined;
      if (d?.lookalikeOf) return "Company identity is a lookalike — not a match";
      if (d?.missing?.includes("conflict_resolution")) return "Sources disagree — preserving both claims";
      if (d?.action === "hold_unknown_domain") return "Company identity is uncertain";
      if (d?.decision === "stop") return "Enough evidence to verify";
      if (d?.tools?.length) return `${d.tools.length} tool${d.tools.length === 1 ? "" : "s"} selected`;
      return "No further research";
    }
    case "research": {
      const d = data as ResearchStepData | undefined;
      if (!d) return message.message;
      if (d.conflicts && d.conflicts.length > 0) {
        return `${d.conflicts.length} conflicting source${d.conflicts.length === 1 ? "" : "s"}`;
      }
      if (!d.found) return "No catalog evidence";
      const independent = d.independentSources ?? 0;
      return independent > 0
        ? `${d.evidence.length} source${d.evidence.length === 1 ? "" : "s"} · ${independent} independent`
        : `${d.evidence.length} source${d.evidence.length === 1 ? "" : "s"} searched`;
    }
    case "match": {
      const d = data as MatchStepData | undefined;
      const identity = d?.verification.claims?.find((c) => c.id === "company");
      if (identity) return `Identity confidence: ${claimWord(identity.status)}`;
      if (d?.verification.status === "failed") return "Identity did not hold";
      if (d?.verification.status === "needs_review") return "Held pending stronger evidence";
      return d ? `Confidence ${Math.round(d.verification.confidence * 100)}%` : message.message;
    }
    case "audit": {
      const d = data as AuditStepData | undefined;
      if (!d) return message.message;
      return d.audit.decision === "publish"
        ? "Privacy threshold passed"
        : "Privacy threshold not met";
    }
    case "publish":
      return message.status === "ok" ? "Publication approved" : "Held — not published";
    case "place": {
      const d = data as { neighbors?: unknown[]; pool?: number } | undefined;
      const n = d?.neighbors?.length ?? 0;
      if (n === 0) return "No evidenced neighbor yet";
      return `${n} evidenced neighbor${n === 1 ? "" : "s"}`;
    }
    default:
      return message.message;
  }
}

export function outcomeStamp(args: {
  done?: DoneMessage;
  questions?: boolean;
  error?: string | null;
  match?: MatchStepData;
  research?: ResearchStepData;
  audit?: AuditStepData;
}): { stamp: OutcomeStamp; detail: string } {
  if (args.error) return { stamp: "MODEL FAILURE", detail: args.error };
  if (args.questions) return { stamp: "NEEDS CLARIFICATION", detail: "The agent stopped to ask rather than guess." };
  if (!args.done) return { stamp: "HELD", detail: "Still running." };

  const match = args.match?.verification;
  const research = args.research;
  const audit = args.audit?.audit;

  if (args.done.outcome === "published") {
    return { stamp: "VERIFIED", detail: args.done.reason };
  }
  if (audit && audit.decision !== "publish" && args.done.outcome === "withheld") {
    return { stamp: "PRIVACY BLOCKED", detail: audit.reason };
  }
  if (match?.status === "failed" && match.inconsistencies.some((line) => /mismatch|different kind of company/i.test(line))) {
    return { stamp: "CONFLICT DETECTED", detail: args.done.reason };
  }
  if (research?.conflicts && research.conflicts.length > 0) {
    return { stamp: "CONFLICT DETECTED", detail: args.done.reason };
  }
  if (match?.claims?.some((c) => c.id === "company" && (c.status === "insufficient" || c.status === "uncertain"))) {
    return { stamp: "IDENTITY UNCERTAIN", detail: args.done.reason };
  }
  if (!research?.found || (research.evidence.length === 0 && match?.status !== "failed")) {
    return { stamp: "INSUFFICIENT EVIDENCE", detail: args.done.reason };
  }
  if (match?.status === "failed") {
    return { stamp: "HELD", detail: args.done.reason };
  }
  return { stamp: "HELD", detail: args.done.reason };
}

function claimWord(status: string): string {
  if (status === "verified") return "high";
  if (status === "probable") return "medium";
  if (status === "uncertain" || status === "insufficient") return "low";
  if (status === "contradicted") return "conflicted";
  return status;
}
