/**
 * Browser client for Barney's agent APIs.
 * No secrets. Session cookie is set by /api/pipeline and /api/intro.
 */

import type { DossierRecord, IntroRequest } from "../../lib/records";
import type { SignalsReport } from "../../lib/signals";
import type { InterviewBrief, MatchResult } from "../../src/types";
import type { FixtureId } from "../../lib/ingest/fixtureCatalog";
import { PROVE_INBOX } from "../../lib/ingest/types";
import type { PipelineMessage } from "../../lib/pipelineWire";

export { PROVE_INBOX };

export async function fetchCircuit(): Promise<{
  records: DossierRecord[];
  meta: { engine: string; engineLabel: string; persistenceLabel: string; total: number };
}> {
  const res = await fetch("/api/circuit", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Circuit could not be loaded.");
  return res.json();
}

export async function searchRole(role: string): Promise<{
  results: { match: MatchResult; record: DossierRecord }[];
  meta: { engine: string; engineLabel: string; pool: number; trace: string[] };
}> {
  const res = await fetch("/api/search", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Search failed.");
  return res.json();
}

export async function fetchSignals(params: Record<string, string> = {}): Promise<{
  report: SignalsReport;
  meta: { engine: string; engineLabel: string };
}> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`/api/signals${qs.size ? `?${qs}` : ""}`, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Signals could not be loaded.");
  return res.json();
}

export async function fetchIntros(): Promise<{ intros: IntroRequest[] }> {
  const res = await fetch("/api/intro", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Intros could not be loaded.");
  return res.json();
}

export async function requestIntro(recordId: string, roleDescription: string): Promise<{ intro: IntroRequest }> {
  const res = await fetch("/api/intro", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "request", recordId, roleDescription }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Intro request failed.");
  }
  return res.json();
}

export async function decideIntro(introId: string, decision: "approved" | "declined"): Promise<{ intro: IntroRequest }> {
  const res = await fetch("/api/intro", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "decide", introId, decision }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Could not decide intro.");
  }
  return res.json();
}

export async function fetchBrief(
  recordId: string,
  roleDescription: string,
  introId?: string,
): Promise<{ brief: InterviewBrief; record: DossierRecord }> {
  const res = await fetch("/api/brief", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recordId, roleDescription, introId }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Brief refused.");
  return body as { brief: InterviewBrief; record: DossierRecord };
}

export type PipelineBody = {
  fixture?: FixtureId;
  simulation?: boolean;
  description?: string;
  forwardedEmails?: string;
  priorAnswers?: Record<string, string>;
  role?: string;
};

export async function startPipeline(body: PipelineBody): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch("/api/pipeline", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(res.status === 400 ? "That inbound wasn't accepted." : "The pipeline couldn't start.");
  }
  return res.body;
}

export async function readSse(
  stream: ReadableStream<Uint8Array>,
  onMessage: (msg: PipelineMessage) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal?.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        onMessage(JSON.parse(line.slice(6)) as PipelineMessage);
      } catch {
        /* partial frame */
      }
    }
  }
}
