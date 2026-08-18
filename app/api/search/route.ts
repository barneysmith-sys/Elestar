import { z } from "zod";
import { reasonMatch } from "../../../lib/agents";
import { listPublishedDossiers, monthsAgo } from "../../../lib/store";
import { engineLabel } from "../../../lib/capabilities";

export const dynamic = "force-dynamic";

const RequestZ = z.object({
  role: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(20).optional(),
});

/**
 * Search the intelligence pool.
 *
 * The candidate set handed to the matcher is already legal: only published
 * records are loaded, and only their anonymised projection exists to be
 * loaded. That ordering is deliberate — hard filters belong in the query, not
 * in the ranker, because a model that can be argued out of a floor can be
 * argued out of a blocklist, and that is a privacy incident rather than a
 * ranking bug.
 */
export async function POST(req: Request): Promise<Response> {
  const body = RequestZ.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const published = await listPublishedDossiers();
    if (published.length === 0) {
      return Response.json({
        results: [],
        meta: { engine: "deterministic", engineLabel: engineLabel("deterministic"), pool: 0, trace: [] },
      });
    }

    const { value: matches, engine, trace } = await reasonMatch({
      roleDescription: body.data.role,
      candidates: published.map((d) => ({
        recordId: d.id,
        record: d.parsed,
        monthsAgo: monthsAgo(d.createdAt),
      })),
      limit: body.data.limit ?? 8,
    });

    const byId = new Map(published.map((d) => [d.id, d]));
    const results = matches
      .map((m) => {
        const record = byId.get(m.recordId);
        return record ? { match: m, record } : null;
      })
      .filter((r): r is { match: (typeof matches)[number]; record: (typeof published)[number] } => r !== null);

    return Response.json({
      results,
      meta: { engine, engineLabel: engineLabel(engine), pool: published.length, trace },
    });
  } catch (err) {
    return Response.json(
      { error: "Search failed.", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
