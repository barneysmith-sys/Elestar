import { z } from "zod";
import { reasonBrief } from "../../../lib/agents";
import { getDossier, getIntroRequest, listIntroRequests } from "../../../lib/store";
import { engineLabel } from "../../../lib/capabilities";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

const RequestZ = z.object({
  recordId: z.string().min(1).max(64),
  roleDescription: z.string().min(1).max(2000),
  hiringLoop: z.array(z.string().max(120)).max(12).optional(),
  introId: z.string().min(1).max(64).optional(),
});

/**
 * Generates the interview brief.
 *
 * Gated on an approved intro, and gated here on the server rather than by
 * hiding a button: the brief is the reward for the candidate's approval, and
 * generating one before that approval creates an artifact that shouldn't
 * exist yet. A request without an approved intro is a 403, not an empty brief.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  const body = RequestZ.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { recordId, roleDescription, hiringLoop, introId } = body.data;

  try {
    const record = await getDossier(recordId);
    if (!record) {
      return Response.json({ error: "No such published record." }, { status: 404 });
    }

    const intro = introId
      ? await getIntroRequest(introId)
      : (await listIntroRequests()).find(
          (r) => r.dossierId === record.id && r.recruiterId === session.recruiterId,
        );

    if (!intro || intro.dossierId !== record.id) {
      return Response.json(
        { error: "A brief requires an approved intro for this record. Request one first." },
        { status: 403 },
      );
    }
    if (intro.status !== "approved") {
      return Response.json(
        {
          error:
            intro.status === "pending"
              ? "This intro is still pending the candidate's approval."
              : "This intro was declined, so no brief is available.",
          status: intro.status,
        },
        { status: 403 },
      );
    }

    const { value: brief, engine } = await reasonBrief({
      record: record.parsed,
      roleDescription,
      hiringLoop,
    });

    return Response.json({
      brief,
      record,
      intro,
      meta: { engine, engineLabel: engineLabel(engine) },
    });
  } catch (err) {
    return Response.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
