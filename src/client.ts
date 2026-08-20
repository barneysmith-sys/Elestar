import Anthropic from "@anthropic-ai/sdk";
import { logPipeline } from "../lib/observe";

// Verify these identifiers against current Anthropic docs before shipping.
// Model names change; this file is the single place they appear.
export const MODELS = {
  parse:     "claude-sonnet-5",
  redaction: "claude-sonnet-5",
  match:     "claude-sonnet-5",
  brief:     "claude-sonnet-5",
  pattern:   "claude-opus-5",
} as const;

let cached: Anthropic | undefined;

function client(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  cached = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 2 });
  return cached;
}

/** Lazy Anthropic client. Instantiated only when a model call actually runs. */
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const real = client();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/**
 * Calls the model and returns parsed JSON, validated by `validate`.
 * One retry on validation failure with the error fed back in.
 * SDK retries cover transport failures. Throws after the second validation
 * failure — callers route that to human review. Prompt text is never logged.
 */
export async function callJSON<T>(opts: {
  model: string;
  system: string;
  user: string;
  validate: (v: unknown) => T;
  maxTokens?: number;
}): Promise<T> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];
  const started = Date.now();

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client().messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2000,
      system: opts.system,
      messages,
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const cleaned = text.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();

    try {
      const value = opts.validate(JSON.parse(cleaned));
      logPipeline({
        event: "model_call",
        model: opts.model,
        attempt,
        ok: true,
        durationMs: Date.now() - started,
        inputTokens: res.usage?.input_tokens,
        outputTokens: res.usage?.output_tokens,
      });
      return value;
    } catch (err) {
      logPipeline({
        event: "model_call",
        model: opts.model,
        attempt,
        ok: false,
        durationMs: Date.now() - started,
        error: "validation_failed",
      });
      if (attempt === 1) throw new AgentValidationError(String(err), cleaned);
      messages.push(
        { role: "assistant", content: cleaned },
        {
          role: "user",
          content:
            `That response failed validation: ${String(err)}\n` +
            `Return only corrected JSON, no prose, no code fences.`,
        },
      );
    }
  }
  throw new Error("unreachable");
}

export class AgentValidationError extends Error {
  constructor(message: string, public raw: string) {
    super(message);
    this.name = "AgentValidationError";
  }
}
