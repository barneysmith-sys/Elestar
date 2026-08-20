import { z } from "zod";
import { runPipeline } from "../../../lib/pipeline";
import { getSession, serializeDemoSessionCookie } from "../../../lib/session";
import { getCapabilities, engineLabel, persistenceLabel, reasoningEngine } from "../../../lib/capabilities";
import { collectEmails } from "../../../lib/verify/email";
import { FIXTURE_IDS, INBOUND_FIXTURES, PROVE_INBOX, isFixtureId } from "../../../lib/ingest/inbound";
import { logPipeline, newPipelineId } from "../../../lib/observe";

export const dynamic = "force-dynamic";

const RequestZ = z
  .object({
    description: z.string().max(8000).optional().default(""),
    forwardedEmails: z.string().max(24000).optional(),
    knownNames: z.array(z.string().max(120)).max(10).optional(),
    priorAnswers: z.record(z.string(), z.string()).optional(),
    recruiterEmail: z.string().max(254).optional(),
    role: z.string().max(200).optional(),
    fixture: z.enum(FIXTURE_IDS).optional(),
    simulation: z.boolean().optional(),
  })
  .refine(
    (v) => Boolean(v.fixture || v.description?.trim() || v.forwardedEmails?.trim()),
    { message: "Forward a recruiter email to prove@elestar.ai, or simulate an inbound fixture." },
  );

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();

  const parsedBody = RequestZ.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const {
    description,
    forwardedEmails,
    knownNames,
    priorAnswers,
    recruiterEmail,
    role,
    fixture,
    simulation,
  } = parsedBody.data;

  const fixtureRaw = fixture && isFixtureId(fixture) ? INBOUND_FIXTURES[fixture].raw : "";
  const leakNet = collectEmails(description, forwardedEmails, recruiterEmail, fixtureRaw);

  const capabilities = getCapabilities();
  if (capabilities.requirePersistence && !capabilities.persistence) {
    return Response.json(
      { error: "This deployment requires Supabase persistence. Nothing was processed." },
      { status: 503 },
    );
  }
  const isSimulation = Boolean(simulation || fixture);
  if (isSimulation && !capabilities.allowSimulation) {
    return Response.json(
      { error: "Simulation is disabled on this deployment. Forward a real recruiter email to prove@elestar.ai." },
      { status: 403 },
    );
  }

  const encoder = new TextEncoder();
  const pipelineId = newPipelineId();
  logPipeline({ event: "pipeline_http", pipelineId, simulation: isSimulation });

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
        simulation: isSimulation,
        inbox: PROVE_INBOX,
        pipelineId,
      });

      try {
        for await (const message of runPipeline({
          userId: session.userId,
          description,
          forwardedEmails,
          knownNames,
          priorAnswers,
          recruiterEmail,
          role: fixture ? INBOUND_FIXTURES[fixture].role : role,
          fixture,
          simulation: isSimulation,
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

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });

  if (!session.authenticated) {
    response.headers.append("Set-Cookie", serializeDemoSessionCookie(session.userId));
  }

  return response;
}
