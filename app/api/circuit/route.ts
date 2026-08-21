import { listPublishedDossiers } from "../../../lib/store";
import { getCapabilities, engineLabel, persistenceLabel, reasoningEngine } from "../../../lib/capabilities";
import { buildCircuitGraph } from "../../../lib/circuitGraph";

export const dynamic = "force-dynamic";

/**
 * The Circuit: every record that has cleared redaction.
 *
 * `listPublishedDossiers` filters on `redaction_decision = 'publish'`, which
 * is the same condition the `dossiers_recruiter_select` RLS policy checks — an
 * unpublished record is not hidden by this endpoint, it is unreachable through
 * it.
 */
export async function GET(): Promise<Response> {
  const capabilities = getCapabilities();

  try {
    const records = await listPublishedDossiers();
    const graph = buildCircuitGraph(records);
    return Response.json({
      records,
      graph,
      meta: {
        engine: reasoningEngine(),
        engineLabel: engineLabel(reasoningEngine()),
        persistence: capabilities.persistence,
        persistenceLabel: persistenceLabel(capabilities.persistence),
        total: records.length,
        edges: graph.edges.length,
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Could not load the Circuit.", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
