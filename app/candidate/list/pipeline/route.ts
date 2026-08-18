import { z } from "zod";
import { runPipeline } from "../../../../lib/pipeline";
import { getAuthenticatedUserId } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

const RequestZ = z.object({
  description: z.string().min(1).max(8000),
  priorAnswers: z.record(z.string(), z.string()).optional(),
});

/**
 * The original pipeline endpoint, kept intact.
 *
 * /api/pipeline supersedes it and is what the product calls: that one issues a
 * demo session when Supabase isn't configured, so the flow works without
 * credentials. This one deliberately keeps its original contract — a real
 * authenticated Supabase user or a 401 — so any existing integration against
 * it behaves exactly as it did.
 */
export async function POST(req: Request): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parsedBody = RequestZ.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return new Response("Invalid request body", { status: 400 });
  }
  const { description, priorAnswers } = parsedBody.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        for await (const message of runPipeline({ userId, description, priorAnswers })) {
          send(message);
        }
      } catch {
        // Belt-and-suspenders: runPipeline already fails closed on every step
        // it controls, but an unexpected throw here must still reach the client
        // as an explicit failure, never a silently truncated stream that could
        // read as "it worked."
        send({
          kind: "done",
          outcome: "withheld",
          reason: "Something went wrong on our end. Nothing was published.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
