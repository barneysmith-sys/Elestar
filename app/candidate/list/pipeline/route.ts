import { z } from "zod";
import { runPipeline } from "../../../../lib/pipeline";
import { getAuthenticatedUserId } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

const RequestZ = z.object({
  description: z.string().max(8000).optional().default(""),
  forwardedEmails: z.string().max(24000).optional(),
  priorAnswers: z.record(z.string(), z.string()).optional(),
  recruiterEmail: z.string().max(254).optional(),
  role: z.string().max(200).optional(),
}).refine((v) => Boolean(v.description?.trim() || v.forwardedEmails?.trim()), {
  message: "Forwarded recruiter emails or notes are required",
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
  const { description, forwardedEmails, priorAnswers, recruiterEmail, role } = parsedBody.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        for await (const message of runPipeline({
          userId,
          description,
          forwardedEmails,
          priorAnswers,
          recruiterEmail,
          role,
        })) {
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
