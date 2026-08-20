/**
 * Product-level structured logs. Never write secrets, raw mail, or mailboxes.
 */

const SENSITIVE = /email|mailbox|token|secret|key|authorization|cookie|raw|password/i;

export function newPipelineId(): string {
  return `ppl-${crypto.randomUUID()}`;
}

export function logPipeline(fields: {
  event: string;
  pipelineId?: string;
  stage?: string;
  durationMs?: number;
  outcome?: string;
  engine?: string;
  simulation?: boolean;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  ok?: boolean;
  tool?: string;
  sourceCount?: number;
  evidenceCount?: number;
  attempt?: number;
  decision?: string;
  holdReason?: string;
  replan?: boolean;
  confidence?: number;
  error?: string;
}): void {
  const safe: Record<string, unknown> = { ts: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (SENSITIVE.test(key)) continue;
    safe[key] = value;
  }
  console.info(JSON.stringify(safe));
}
