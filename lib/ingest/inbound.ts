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
import { FIXTURE_CATALOG, type FixtureId, type FixtureMeta } from "./fixtureCatalog";
import { PROVE_INBOX, type InboxArrival } from "./types";

export { FIXTURE_IDS, FIXTURE_CATALOG, isFixtureId, type FixtureId, type FixtureMeta } from "./fixtureCatalog";
export { PROVE_INBOX, type InboxArrival } from "./types";

export interface InboundFixture extends FixtureMeta {
  raw: string;
}

export const INBOUND_FIXTURES: Record<FixtureId, InboundFixture> = {
  canonical: { ...FIXTURE_CATALOG.canonical, raw: CANONICAL_FORWARDS },
  healthtech: { ...FIXTURE_CATALOG.healthtech, raw: HEALTHTECH_FORWARDS },
  crypto: { ...FIXTURE_CATALOG.crypto, raw: CRYPTO_FORWARDS },
  pii: { ...FIXTURE_CATALOG.pii, raw: CANONICAL_FORWARDS },
  mismatch: { ...FIXTURE_CATALOG.mismatch, raw: MISMATCH_FORWARDS },
  gmail: { ...FIXTURE_CATALOG.gmail, raw: GMAIL_FORWARDS },
  contradiction: { ...FIXTURE_CATALOG.contradiction, raw: SCREEN_ONLY_FORWARDS },
  nda: { ...FIXTURE_CATALOG.nda, raw: CANONICAL_FORWARDS },
};

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
