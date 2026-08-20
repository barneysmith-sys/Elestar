/**
 * Signed inbound at prove@elestar.ai.
 *
 * The provider (Resend, Postmark, SES) posts here. This module only parses
 * a payload into raw RFC822-ish text. Authentication lives on the route.
 * Fixtures are not accepted — simulated mail never enters through this door.
 */

import { timingSafeEqual } from "node:crypto";

export function inboundWebhookConfigured(): boolean {
  return Boolean(process.env.INBOUND_WEBHOOK_SECRET?.trim());
}

export function verifyInboundSecret(provided: string | null): boolean {
  const expected = process.env.INBOUND_WEBHOOK_SECRET?.trim();
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function secretFromHeaders(headers: Headers): string | null {
  const dedicated = headers.get("x-elestar-webhook-secret");
  if (dedicated) return dedicated.trim();
  const auth = headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

export interface InboundPayload {
  raw: string;
  messageId: string | null;
  from: string | null;
  subject: string | null;
}

/**
 * Accept a generic `{ raw }` body, or reconstruct a thread from common
 * inbound-provider fields. Never treats a fixture id as mail.
 */
export function parseInboundPayload(body: unknown): InboundPayload | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  if (typeof rec.fixture === "string") return null;

  const nested = rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : rec;

  const rawDirect = asString(nested.raw) || asString(rec.raw);
  if (rawDirect?.includes("From:")) {
    return {
      raw: rawDirect,
      messageId: asString(nested.messageId) ?? asString(nested.MessageID) ?? asString(nested.email_id),
      from: asString(nested.from) ?? asString(nested.From),
      subject: asString(nested.subject) ?? asString(nested.Subject),
    };
  }

  const from = asString(nested.from) ?? asString(nested.From) ?? asString(nested.sender);
  const to = asString(nested.to) ?? asString(nested.To) ?? "prove@elestar.ai";
  const subject = asString(nested.subject) ?? asString(nested.Subject) ?? "(no subject)";
  const text = asString(nested.text) ?? asString(nested.TextBody) ?? asString(nested.html) ?? asString(nested.HtmlBody);
  if (!from || !text) return null;

  const date = new Date().toUTCString();
  const raw = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, `Date: ${date}`, "", text].join("\r\n");
  return {
    raw,
    messageId: asString(nested.messageId) ?? asString(nested.MessageID) ?? asString(nested.email_id),
    from,
    subject,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
