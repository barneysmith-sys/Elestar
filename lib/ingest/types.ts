/**
 * Inbound types that the browser is allowed to import.
 *
 * Raw recruiter mail and fixture bodies stay in inbound.ts (server-only
 * callers). The UI needs the inbox address and the arrival shape that the
 * pipeline already redacted onto the SSE wire.
 */

export const PROVE_INBOX = "prove@elestar.ai";

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
