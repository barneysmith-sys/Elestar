import { z } from "zod";
import { runScout } from "../../../lib/scout";
import { getCapabilities, engineLabel, persistenceLabel, reasoningEngine } from "../../../lib/capabilities";
import { PROVE_INBOX } from "../../../lib/ingest/types";

export const dynamic = "force-dynamic";

const RequestZ = z.object({
  role: z.string().min(1).max(2000),
});

/**
 * Hire Scout: the same reasoners as search + Circuit, streamed as they run.
 * Nothing here is a timer. Skip suggestions come only from published records.
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = RequestZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Describe the role in sentences." }, { status: 400 });
  }

  const capabilities = getCapabilities();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      send({
        kind: "meta",
        engine: reasoningEngine(),
        engineLabel: engineLabel(reasoningEngine()),
        persistence: capabilities.persistence,
        persistenceLabel: persistenceLabel(capabilities.persistence),
        authenticated: false,
        simulation: false,
        inbox: PROVE_INBOX,
      });
      try {
        for await (const message of runScout({ role: parsed.data.role, signal: req.signal })) {
          if (message.kind === "meta") continue;
          send(message);
        }
      } catch {
        send({
          kind: "done",
          outcome: "withheld",
          reason: "The scout could not finish. Nothing was invented.",
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
      "X-Accel-Buffering": "no",
    },
  });
}
