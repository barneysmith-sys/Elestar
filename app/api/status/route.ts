import { engineLabel, getCapabilities, persistenceLabel, reasoningEngine } from "../../../lib/capabilities";
import { K_FLOOR } from "../../../src/redactionAudit";
import { listPublishedDossiers } from "../../../lib/store";

export const dynamic = "force-dynamic";

/**
 * What this deployment can currently do, and what it is running on.
 *
 * Every surface that shows an engine badge reads from here, so there is one
 * answer to "is this real?" rather than a per-page guess.
 */
export async function GET(): Promise<Response> {
  const capabilities = getCapabilities();
  const engine = reasoningEngine();

  let poolSize = 0;
  let poolError: string | null = null;
  try {
    poolSize = (await listPublishedDossiers()).length;
  } catch (err) {
    poolError = String(err instanceof Error ? err.message : err);
  }

  return Response.json({
    engine,
    engineLabel: engineLabel(engine),
    persistence: capabilities.persistence,
    persistenceLabel: persistenceLabel(capabilities.persistence),
    kFloor: K_FLOOR,
    poolSize,
    poolError,
    /** Deterministic Elestar logic that is real regardless of configuration. */
    alwaysReal: [
      "PII redaction (src/redact.ts)",
      "Tier rules (src/parseProcess.ts computeTier)",
      `k-anonymity floor of k=${K_FLOOR} (src/redactionAudit.ts)`,
      "Evidence depth weighting (src/matchRecords.ts DEPTH_WEIGHT)",
      "Recency discounting (src/matchRecords.ts recencyMultiplier)",
      "Fail-closed publish gating (lib/pipeline.ts)",
      "Intro approval gate (lib/store.ts, supabase/migrations RLS + CHECK)",
    ],
  });
}
