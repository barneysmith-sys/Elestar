import { z } from "zod";
import { runPipeline } from "../../../lib/pipeline";
import { getSession, demoSessionCookie } from "../../../lib/session";
import { getCapabilities, engineLabel, persistenceLabel, reasoningEngine } from "../../../lib/capabilities";
import { collectEmails } from "../../../lib/verify/email";

export const dynamic = "force-dynamic";

const RequestZ = z
  .object({
    description: z.string().max(8000).optional().default(""),
    forwardedEmails: z.string().max(24000).optional(),
    knownNames: z.array(z.string().max(120)).max(10).optional(),
    priorAnswers: z.record(z.string(), z.string()).optional(),
    recruiterEmail: z.string().max(254).optional(),
    role: z.string().max(200).optional(),
  })
  .refine((v) => Boolean(v.description?.trim() || v.forwardedEmails?.trim()), {
    message: "Forwarded recruiter emails or notes are required",
  });

/**
 * Streams the listing pipeline as server-sent events, one message per stage.
 *
 * The stream opens with a `meta` message declaring which engines are actually
 * in play, so the client can label the run before any reasoning happens
 * rather than retrofitting a disclaimer onto results.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();

  const parsedBody = RequestZ.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { description, forwardedEmails, knownNames, priorAnswers, recruiterEmail, role } = parsedBody.data;
  const leakNet = collectEmails(description, forwardedEmails, recruiterEmail);

  const capabilities = getCapabilities();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (leakNet.length > 0) {
          const serialised = JSON.stringify(obj).toLowerCase();
          if (leakNet.some((email) => serialised.includes(email))) {
            throw new Error("recruiter email leaked onto the event stream");
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      send({
        kind: "meta",
        engine: reasoningEngine(),
        engineLabel: engineLabel(reasoningEngine()),
        persistence: capabilities.persistence,
        persistenceLabel: persistenceLabel(capabilities.persistence),
        authenticated: session.authenticated,
      });

      try {
        for await (const message of runPipeline({
          userId: session.userId,
          description,
          forwardedEmails,
          knownNames,
          priorAnswers,
          recruiterEmail,
          role,
        })) {
          send(message);
        }
      } catch {
        // Belt-and-suspenders: runPipeline already fails closed on every step
        // it controls, but an unexpected throw here must still reach the
        // client as an explicit failure, never a silently truncated stream
        // that could read as "it worked." A recruiter-email leak in a frame
        // also lands here and withholds rather than sending the frame.
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

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });

  if (!session.authenticated) {
    const cookie = demoSessionCookie(session.userId);
    response.headers.append(
      "Set-Cookie",
      `${cookie.name}=${cookie.value}; Path=${cookie.options.path}; Max-Age=${cookie.options.maxAge}; HttpOnly; SameSite=Lax`,
    );
  }

  return response;
}
