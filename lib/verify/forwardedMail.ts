/**
 * Parse recruiter emails a candidate forwarded to Elestar.
 *
 * This is not inbox access and not a crawl of a recruiter's mail server.
 * The candidate hands us the messages (paste, or later: forward to an
 * ingest address). We read From/Subject/Date/body to learn:
 *
 *   - which company domain the process belonged to
 *   - which rounds were actually scheduled or completed
 *   - how far the loop got (the furthest round the mail sequence reached)
 *
 * The raw mailbox never belongs on a public payload. Callers must run
 * `assertNoRecruiterEmail` on anything that leaves this module's private fields.
 */

import type { RoundType } from "../../src/types";
import { maskEmail, parseRecruiterSignal, type RecruiterSignal } from "./email";

export interface MailRoundSignal {
  type: RoundType;
  label: string;
  event: "scheduled" | "completed" | "rejected" | "mentioned";
}

export interface ParsedForwardedMessage {
  /** Redacted subject — identity tokens already stripped. */
  subject: string;
  date: string | null;
  fromDomain: string;
  maskedFrom: string;
  signals: MailRoundSignal[];
  excerpt: string;
}

export interface ForwardedMailEvidence {
  messages: ParsedForwardedMessage[];
  /** Private. Never serialise onto a public or SSE payload. */
  recruiterEmails: string[];
  /** Display names from From: lines, for redaction only. */
  senderNames: string[];
  primarySignal: RecruiterSignal;
  /** Prose the process parser can read, derived from the mail, no mailboxes. */
  digest: string;
  lastReached: RoundType | null;
  lastReachedLabel: string | null;
  /** Best-effort role from subject/body. Never a mailbox. */
  extractedRole: string | null;
  /** Date header of the latest message, if present. */
  interviewDate: string | null;
  processSignals: string[];
  trace: string[];
}

const ROUND_HINTS: { type: RoundType; label: string; re: RegExp }[] = [
  { type: "screen", label: "Recruiter screen", re: /\b(recruiter screen|phone screen|intro call|screening call|30[- ]?min(?:ute)? intro)\b/i },
  { type: "take_home", label: "Take-home exercise", re: /\b(take[- ]?home|coding challenge|work sample)\b/i },
  { type: "technical", label: "Technical interview", re: /\b(technical interview|coding interview|live coding|pair programming)\b/i },
  { type: "system_design", label: "System design", re: /\b(system design|architecture (?:interview|round))\b/i },
  { type: "case", label: "Case study", re: /\b(case study|case interview)\b/i },
  { type: "panel", label: "Panel interview", re: /\b(onsite|on[- ]site|loop day|panel interview|virtual onsite)\b/i },
  { type: "final", label: "Final round", re: /\b(final (?:round|panel|interview)|hiring committee|bar raiser)\b/i },
];

const ROUND_RANK: Record<RoundType, number> = {
  other: 0,
  screen: 1,
  take_home: 2,
  technical: 3,
  case: 3,
  system_design: 4,
  panel: 5,
  final: 6,
};

const COMPLETED = /\b(you(?:'re| are) through|moving you (?:forward|on)|next step|glad that went well|thanks for taking the time yesterday|great conversation)\b/i;
const REJECTED = /\b(moving forward with other candidates|not moving forward|decided to go in another direction|rejected after|after the final)\b/i;
const SCHEDULED = /\b(confirming|scheduled|invite|calendar|tomorrow|this (?:thursday|friday|monday|week))\b/i;

/**
 * Split a pasted forward dump into messages. Handles Gmail-style
 * "Forwarded message" blocks and simple `From:` separators.
 */
export function splitForwardedMessages(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const chunks = text.split(
    /\n(?=From:\s)|-{5,}\s*\n(?:Begin forwarded message:?\s*\n)?|\n-{3,} Forwarded message -{3,}\n/i,
  );
  return chunks.map((c) => c.trim()).filter((c) => c.length > 0);
}

function header(block: string, name: string): string | null {
  const re = new RegExp(`^${name}:\\s*(.+)$`, "im");
  const m = block.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractAddress(fromLine: string | null): string | null {
  if (!fromLine) return null;
  const angle = fromLine.match(/<([^>]+@[^>]+)>/);
  if (angle) return angle[1]!.trim();
  const bare = fromLine.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return bare?.[0] ?? null;
}

function extractDisplayName(fromLine: string | null): string | null {
  if (!fromLine) return null;
  const before = fromLine.replace(/<[^>]+>/, "").replace(/["']/g, "").trim();
  if (!before || before.includes("@")) return null;
  return before;
}

function redactIdentity(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, "[phone]")
    .replace(/\bhttps?:\/\/\S+/gi, "[url]");
}

function signalsIn(text: string): MailRoundSignal[] {
  const found: MailRoundSignal[] = [];
  for (const hint of ROUND_HINTS) {
    if (!hint.re.test(text)) continue;
    let event: MailRoundSignal["event"] = "mentioned";
    if (REJECTED.test(text)) event = "rejected";
    else if (COMPLETED.test(text)) event = "completed";
    else if (SCHEDULED.test(text)) event = "scheduled";
    found.push({ type: hint.type, label: hint.label, event });
  }
  // "final panel" is one round. Counting it as both inflates how far they got.
  // A loop that names a panel *and* a final round is two rounds and must stay two.
  if (
    /\bfinal panel\b/i.test(text) &&
    found.some((s) => s.type === "final") &&
    found.some((s) => s.type === "panel")
  ) {
    return found.filter((s) => s.type !== "panel");
  }
  return found;
}

export function parseForwardedMail(raw: string): ForwardedMailEvidence {
  const trace: string[] = [];
  const blocks = splitForwardedMessages(raw);
  const recruiterEmails: string[] = [];
  const senderNames: string[] = [];
  const messages: ParsedForwardedMessage[] = [];

  for (const block of blocks) {
    const fromLine = header(block, "From");
    const address = extractAddress(fromLine);
    const name = extractDisplayName(fromLine);
    const subjectRaw = header(block, "Subject") ?? "(no subject)";
    const date = header(block, "Date") ?? header(block, "Sent") ?? null;
    const body = block.replace(/^(From|Subject|Date|Sent|To|Cc):.*$/gim, "").trim();
    const combined = `${subjectRaw}\n${body}`;
    const sigs = signalsIn(combined);

    if (address) recruiterEmails.push(address.toLowerCase());
    if (name) senderNames.push(name);
    const signal = parseRecruiterSignal(address ?? "");
    messages.push({
      subject: redactIdentity(subjectRaw),
      date,
      fromDomain: signal.domain,
      maskedFrom: address ? maskEmail(address) : "[email]",
      signals: sigs,
      excerpt: redactIdentity(body).slice(0, 180).replace(/\s+/g, " ").trim(),
    });
  }

  const uniqueEmails = [...new Set(recruiterEmails)];
  const companyEmails = uniqueEmails.filter((e) => parseRecruiterSignal(e).kind === "company");
  const primary = parseRecruiterSignal(companyEmails[0] ?? uniqueEmails[0] ?? "");

  if (messages.length === 0) {
    trace.push("No forwarded messages to read.");
  } else {
    trace.push(`Read ${messages.length} forwarded message(s).`);
    if (primary.kind === "company") {
      trace.push(`Sender domain ${primary.domain} is the recruiter signal. The mailbox stays private.`);
    } else {
      trace.push(primary.reason);
    }
  }

  const furthest = furthestRound(messages);
  const lastReached = furthest?.type ?? null;
  const lastReachedLabel = furthest?.label ?? null;
  if (lastReachedLabel) {
    trace.push(`Last round the mail sequence reached: ${lastReachedLabel}.`);
  }

  const rejected = messages.some((m) => m.signals.some((s) => s.event === "rejected")) || REJECTED.test(raw);
  const digest = buildDigest(messages, lastReachedLabel, rejected);
  const extractedRole = extractRole(raw);
  const interviewDate = [...messages].reverse().find((m) => m.date)?.date ?? null;
  const processSignals = uniqueRounds(messages).map((r) => r.label);

  return {
    messages,
    recruiterEmails: uniqueEmails,
    senderNames: [...new Set(senderNames)],
    primarySignal: primary,
    digest,
    lastReached,
    lastReachedLabel,
    extractedRole,
    interviewDate,
    processSignals,
    trace,
  };
}

function extractRole(raw: string): string | null {
  const text = raw.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
  const re =
    /\b((?:head of|vp of|senior|staff|principal|lead)\s+\w+(?:\s+\w+)?\s+(?:engineer|engineering|manager|designer|scientist|analyst|director))\b/gi;
  const matches = [...text.matchAll(re)].map((m) => m[1]!.replace(/\s+/g, " ").trim());
  const clean = matches.find((role) => !/\b(recruiter|interview|round|screen|panel|loop)\b/i.test(role));
  return clean ?? null;
}

function furthestRound(messages: ParsedForwardedMessage[]): MailRoundSignal | null {
  let best: MailRoundSignal | null = null;
  for (const msg of messages) {
    for (const sig of msg.signals) {
      if (!best || ROUND_RANK[sig.type] >= ROUND_RANK[best.type]) best = sig;
    }
  }
  return best;
}

function uniqueRounds(messages: ParsedForwardedMessage[]): MailRoundSignal[] {
  const byType = new Map<RoundType, MailRoundSignal>();
  for (const msg of messages) {
    for (const sig of msg.signals) {
      if (!byType.has(sig.type)) byType.set(sig.type, sig);
    }
  }
  return [...byType.values()].sort((a, b) => ROUND_RANK[a.type] - ROUND_RANK[b.type]);
}

function buildDigest(
  messages: ParsedForwardedMessage[],
  lastReachedLabel: string | null,
  rejected: boolean,
): string {
  if (messages.length === 0) return "";
  const lines: string[] = [
    `The candidate forwarded ${messages.length} recruiter message(s) showing how far they got.`,
  ];
  const rounds = uniqueRounds(messages);
  for (const round of rounds) {
    lines.push(`${round.label}.`);
  }
  if (lastReachedLabel) {
    lines.push(`The last round the mail sequence reached was ${lastReachedLabel}.`);
  }
  if (rejected) {
    lines.push("Candidate was rejected after the final round.");
  }
  return lines.join("\n");
}

export {
  CANONICAL_FORWARDS,
  CRYPTO_FORWARDS,
  GMAIL_FORWARDS,
  HEALTHTECH_FORWARDS,
  MISMATCH_FORWARDS,
  SCREEN_ONLY_FORWARDS,
} from "./mailFixtures";
