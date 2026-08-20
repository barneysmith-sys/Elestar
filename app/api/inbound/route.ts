import { runPipeline } from "../../../lib/pipeline";
import { getCapabilities } from "../../../lib/capabilities";
import { logPipeline, newPipelineId } from "../../../lib/observe";
import { parseInboundPayload, secretFromHeaders, verifyInboundSecret } from "../../../lib/ingest/webhook";
import { PROVE_INBOX } from "../../../lib/ingest/types";

export const dynamic = "force-dynamic";

/**
 * Production ingest for prove@elestar.ai.
 *
 * Requires INBOUND_WEBHOOK_SECRET. Unsigned or fixture payloads are refused.
 * The pipeline that then runs is the same one the product UI uses.
 */
export async function POST(req: Request): Promise<Response> {
  const caps = getCapabilities();
  if (!caps.inboundWebhook) {
    return Response.json(
      { error: "Inbound webhook is not configured.", inbox: PROVE_INBOX, configured: false },
      { status: 503 },
    );
  }
  if (caps.requirePersistence && !caps.persistence) {
    return Response.json(
      { error: "Persistence is required in this deployment. Inbound was not accepted." },
      { status: 503 },
    );
  }
  if (!verifyInboundSecret(secretFromHeaders(req.headers))) {
    return Response.json({ error: "Unauthorized inbound." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const inbound = parseInboundPayload(body);
  if (!inbound) {
    return Response.json({ error: "Inbound payload was not mail." }, { status: 400 });
  }

  const pipelineId = newPipelineId();
  logPipeline({ event: "inbound_accepted", pipelineId, stage: "receive" });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        for await (const message of runPipeline({
          userId: "inbound-prove",
          forwardedEmails: inbound.raw,
          simulation: false,
          pipelineId,
          signal: req.signal,
        })) {
          send(message);
        }
      } catch {
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
      "X-Accel-Buffering": "no",
    },
  });
}
