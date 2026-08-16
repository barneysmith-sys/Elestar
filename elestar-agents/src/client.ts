import Anthropic from "@anthropic-ai/sdk";

// Verify these identifiers against current Anthropic docs before shipping.
// Model names change; this file is the single place they appear.
export const MODELS = {
  parse:     "claude-sonnet-5",
  redaction: "claude-sonnet-5",
  match:     "claude-sonnet-5",
  brief:     "claude-sonnet-5",
  pattern:   "claude-opus-5",
} as const;

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Calls the model and returns parsed JSON, validated by `validate`.
 * One retry on validation failure with the error fed back in.
 * Throws after the second failure — callers route that to human review.
 */
export async function callJSON<T>(opts: {
  model: string;
  system: string;
  user: string;
  validate: (v: unknown) => T;
  maxTokens?: number;
}): Promise<T> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2000,
      system: opts.system,
      messages,
      // Prefill forces the response to open as JSON.
      // Remember to prepend "{" when reassembling.
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const cleaned = text.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();

    try {
      return opts.validate(JSON.parse(cleaned));
    } catch (err) {
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
