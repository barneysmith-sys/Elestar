import { z } from "zod";
import {
  createIntroRequest,
  decideIntro,
  getDossier,
  getIntroRequest,
  listIntroRequests,
} from "../../../lib/store";
import { canDecideIntro, getSession, serializeDemoSessionCookie } from "../../../lib/session";

export const dynamic = "force-dynamic";

const CreateZ = z.object({
  action: z.literal("request"),
  recordId: z.string().min(1).max(64),
  roleDescription: z.string().min(1).max(2000),
});

const DecideZ = z.object({
  action: z.literal("decide"),
  introId: z.string().min(1).max(64),
  decision: z.enum(["approved", "declined"]),
});

const BodyZ = z.discriminatedUnion("action", [CreateZ, DecideZ]);

export async function GET(): Promise<Response> {
  try {
    return Response.json({ intros: await listIntroRequests() });
  } catch (err) {
    return Response.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}

/**
 * The intro state machine: request -> pending -> approved | declined.
 *
 * This is the only path by which identity can ever reach a recruiter, so the
 * transitions are enforced on the server. The client cannot skip `pending`,
 * cannot approve on the candidate's behalf when real auth is present, and
 * cannot cause an identity to be attached to a declined request — that last
 * one is additionally impossible in Postgres, where a CHECK constraint
 * rejects it regardless of what wrote the row.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  const body = BodyZ.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    if (body.data.action === "request") {
      const record = await getDossier(body.data.recordId);
      if (!record) {
        // Either it does not exist or it has not cleared redaction. The
        // response does not distinguish the two: telling a recruiter that an
        // unpublished record exists is itself a disclosure.
        return Response.json({ error: "No such published record." }, { status: 404 });
      }

      const intro = await createIntroRequest({
        dossierId: record.id,
        recruiterId: session.recruiterId,
        roleDescription: body.data.roleDescription,
      });
      return withSession(Response.json({ intro }), session);
    }

    const existing = await getIntroRequest(body.data.introId);
    if (!existing) {
      return Response.json({ error: "No such intro request." }, { status: 404 });
    }
    if (existing.status !== "pending") {
      return Response.json(
        { error: `This request was already ${existing.status}.`, intro: existing },
        { status: 409 },
      );
    }
    if (!canDecideIntro(session, existing.candidateId)) {
      return Response.json({ error: "Only the candidate can decide this." }, { status: 403 });
    }

    const intro = await decideIntro({ introId: body.data.introId, decision: body.data.decision });
    return withSession(Response.json({ intro }), session);
  } catch (err) {
    return Response.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}

function withSession(response: Response, session: { authenticated: boolean; userId: string }): Response {
  if (!session.authenticated) {
    response.headers.append("Set-Cookie", serializeDemoSessionCookie(session.userId));
  }
  return response;
}
