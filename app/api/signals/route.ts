import { listPublishedDossiers } from "../../../lib/store";
import { aggregateSignals, parseSignalsFilter } from "../../../lib/signals";
import { engineLabel, getCapabilities, persistenceLabel, reasoningEngine } from "../../../lib/capabilities";

export const dynamic = "force-dynamic";

/**
 * Aggregate intelligence over published records.
 *
 * Only rows that already cleared `redaction_decision = publish` are counted.
 * Company names are not stored and therefore cannot be filtered or returned.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filter = parseSignalsFilter({
    sector: url.searchParams.get("sector") ?? undefined,
    stage: url.searchParams.get("stage") ?? undefined,
    round: url.searchParams.get("round") ?? undefined,
    competency: url.searchParams.get("competency") ?? undefined,
    days: url.searchParams.get("days") ?? undefined,
    excludeDemo: url.searchParams.get("excludeDemo") ?? undefined,
  });

  try {
    const records = await listPublishedDossiers();
    const report = aggregateSignals(records, filter);
    const capabilities = getCapabilities();
    return Response.json({
      report,
      meta: {
        engine: reasoningEngine(),
        engineLabel: engineLabel(reasoningEngine()),
        persistence: capabilities.persistence,
        persistenceLabel: persistenceLabel(capabilities.persistence),
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Could not load signals.", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
