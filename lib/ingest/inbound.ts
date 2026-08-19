/**
 * Inbound mail at prove@elestar.ai.
 *
 * Production: a provider webhook (Resend, Postmark, SES) delivers a forwarded
 * recruiter/interview email here. The same `receiveInbound()` function is what
 * the listing pipeline runs — the demo does not have a second, fake path.
 *
 * Demo: the browser asks the server to simulate an arrival by fixture id.
 * The UI is labelled as a simulation. The pipeline that then runs is the
 * real one.
 */

import {
  CANONICAL_FORWARDS,
  CRYPTO_FORWARDS,
  GMAIL_FORWARDS,
  HEALTHTECH_FORWARDS,
  MISMATCH_FORWARDS,
  SCREEN_ONLY_FORWARDS,
} from "../verify/mailFixtures";
import { parseForwardedMail, type ForwardedMailEvidence } from "../verify/forwardedMail";
import { maskEmail } from "../verify/email";

export const PROVE_INBOX = "prove@elestar.ai";

export const FIXTURE_IDS = ["canonical", "healthtech", "crypto", "pii", "mismatch", "gmail", "contradiction", "nda"] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];

export interface InboundFixture {
  id: FixtureId;
  label: string;
  note: string;
  role: string;
  notes: string;
  raw: string;
}

export const INBOUND_FIXTURES: Record<FixtureId, InboundFixture> = {
  canonical: {
    id: "canonical",
    label: "Full loop, rejected at the final",
    note: "Publishes. Four messages, three rounds cleared, outcome never stated.",
    role: "Senior Backend Engineer",
    notes: "Senior Backend Engineer at a Series B fintech.",
    raw: CANONICAL_FORWARDS,
  },
  healthtech: {
    id: "healthtech",
    label: "Ambiguous round count",
    note: "Stops and asks. The parser will not guess a round count.",
    role: "Backend Engineer",
    notes: "Series A healthtech company, maybe 40 people. Recruiter screen then a few technical interviews. Never heard back.",
    raw: HEALTHTECH_FORWARDS,
  },
  crypto: {
    id: "crypto",
    label: "Too identifiable to publish",
    note: "Blocked by the privacy audit. Small company, long specific loop.",
    role: "Head of Engineering",
    notes:
      "Recruiter screen, take-home, technical interview, system design, panel, and a final round at a 30 person seed stage crypto company in London over 8 weeks. They went with another candidate.",
    raw: CRYPTO_FORWARDS,
  },
  pii: {
    id: "pii",
    label: "Contains contact details",
    note: "Shows identifiers being stripped before anything is structured.",
    role: "Senior Backend Engineer",
    notes:
      "Reach me at ada@example.com or +1 (415) 555-0199 — portfolio at https://ada.example.com, handle @adalovelace.\nSenior Backend Engineer at a Series B fintech.",
    raw: CANONICAL_FORWARDS,
  },
  mismatch: {
    id: "mismatch",
    label: "Company mismatch",
    note: "Verification fails. Fintech loop against a healthcare recruiter domain.",
    role: "Senior Backend Engineer",
    notes: "Senior Backend Engineer at a Series B fintech.",
    raw: MISMATCH_FORWARDS,
  },
  gmail: {
    id: "gmail",
    label: "Personal mailbox",
    note: "Verification fails. A gmail address is not a company signal.",
    role: "Senior Backend Engineer",
    notes: "Senior Backend Engineer at a Series B fintech.",
    raw: GMAIL_FORWARDS,
  },
  contradiction: {
    id: "contradiction",
    label: "Claim vs mail clash",
    note: "Holds for review. Notes claim a final; the mail only supports a screen.",
    role: "Senior Backend Engineer",
    notes:
      "I reached the final round. Recruiter screen, technical interview, system design, and a final panel at a Series B fintech.",
    raw: SCREEN_ONLY_FORWARDS,
  },
  nda: {
    id: "nda",
    label: "Contains NDA material",
    note: "Confidential sentences are stripped. The loop can still verify.",
    role: "Senior Backend Engineer",
    notes:
      "Project Nightingale is under NDA. Do not share the internal architecture. Senior Backend Engineer at a Series B fintech.",
    raw: CANONICAL_FORWARDS,
  },
};

export function isFixtureId(value: string | undefined | null): value is FixtureId {
  return Boolean(value && (FIXTURE_IDS as readonly string[]).includes(value));
}

/** What the candidate-facing inbox is allowed to show. No raw mailbox. */
export interface InboxArrival {
  to: typeof PROVE_INBOX;
  simulation: boolean;
  fromMasked: string;
  fromDomain: string;
  subject: string;
  messageCount: number;
  receivedAt: string;
  lastReachedLabel: string | null;
}

export interface ReceivedInbound {
  arrival: InboxArrival;
  evidence: ForwardedMailEvidence;
  fixture: InboundFixture | null;
  notes: string;
  role: string;
  raw: string;
}

export function receiveInbound(args: {
  raw: string;
  notes?: string;
  role?: string;
  simulation: boolean;
  fixture?: InboundFixture | null;
}): ReceivedInbound {
  const evidence = parseForwardedMail(args.raw);
  const first = evidence.messages[0];
  const arrival: InboxArrival = {
    to: PROVE_INBOX,
    simulation: args.simulation,
    fromMasked: first?.maskedFrom ?? (evidence.primarySignal.email ? maskEmail(evidence.primarySignal.email) : "[email]"),
    fromDomain: evidence.primarySignal.domain,
    subject: first?.subject ?? "(no subject)",
    messageCount: evidence.messages.length,
    receivedAt: new Date().toISOString(),
    lastReachedLabel: evidence.lastReachedLabel,
  };
  return {
    arrival,
    evidence,
    fixture: args.fixture ?? null,
    notes: args.notes ?? args.fixture?.notes ?? "",
    role: args.role ?? args.fixture?.role ?? evidence.extractedRole ?? "",
    raw: args.raw,
  };
}

export function receiveFixture(id: FixtureId, simulation = true): ReceivedInbound {
  const fixture = INBOUND_FIXTURES[id];
  return receiveInbound({
    raw: fixture.raw,
    notes: fixture.notes,
    role: fixture.role,
    simulation,
    fixture,
  });
}
