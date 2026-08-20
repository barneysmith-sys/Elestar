/**
 * Signed inbound at prove@elestar.ai.
 *
 * The provider (Resend, Postmark, SES) posts here. This module only parses
 * a payload into raw RFC822-ish text. Authentication lives on the route.
 * Fixtures are not accepted — simulated mail never enters through this door.
 */

import { createHash, timingSafeEqual } from "node:crypto";

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

const REPLAY_WINDOW_MS = 15 * 60 * 1000;
const seenInbound = new Map<string, number>();
const rateBuckets = new Map<string, number[]>();

export function inboundTimestamp(headers: Headers, body: unknown): number | null {
  const header = headers.get("x-elestar-timestamp") ?? headers.get("x-webhook-timestamp");
  if (header && /^\d+$/.test(header.trim())) {
    const n = Number(header.trim());
    return n < 1e12 ? n * 1000 : n;
  }
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const raw = rec.timestamp ?? rec.Date ?? rec.date;
    if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
    if (typeof raw === "string") {
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

/** Missing timestamps are allowed (providers vary). Stale ones are not. */
export function inboundReplayOk(timestampMs: number | null, now = Date.now()): boolean {
  if (timestampMs == null) return true;
  return Math.abs(now - timestampMs) <= REPLAY_WINDOW_MS;
}

export function inboundContentKey(raw: string, messageId?: string | null): string {
  const basis = messageId?.trim() || raw;
  return createHash("sha256").update(basis).digest("hex");
}

/** Returns false if this inbound was already accepted recently. */
export function rememberInbound(key: string, now = Date.now()): boolean {
  for (const [existing, at] of seenInbound) {
    if (now - at > REPLAY_WINDOW_MS) seenInbound.delete(existing);
  }
  if (seenInbound.has(key)) return false;
  seenInbound.set(key, now);
  return true;
}

export function inboundRateOk(bucket: string, now = Date.now(), limit = 30, windowMs = 60_000): boolean {
  const cutoff = now - windowMs;
  const prior = (rateBuckets.get(bucket) ?? []).filter((t) => t > cutoff);
  if (prior.length >= limit) {
    rateBuckets.set(bucket, prior);
    return false;
  }
  prior.push(now);
  rateBuckets.set(bucket, prior);
  return true;
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
