/**
 * Pattern review — inspect a published record against the pool.
 *
 * Batch-style and fail-open: this never un-publishes. A flag is a note for a
 * person, not a gate. Missing data is said, not filled in.
 */

import type { PatternReview } from "../../src/types";
import type { DossierRecord } from "../records";
import type { ParsedProcess } from "../../src/types";

export function reviewPatternDeterministic(args: {
  recordId: string;
  record: ParsedProcess;
  pool: DossierRecord[];
}): { review: PatternReview; trace: string[] } {
  const { recordId, record, pool } = args;
  const trace: string[] = [];
  const signals: PatternReview["signals"] = [];

  const others = pool.filter((row) => row.id !== recordId && row.redactionDecision === "publish");
  const ownRounds = record.rounds.map((r) => r.type).sort().join(",");
  const ownComps = record.competencies
    .filter((c) => c.depth === "assessed")
    .map((c) => c.name.toLowerCase())
    .sort()
    .join(",");
  const twin = others.find((row) => {
    const rounds = row.parsed.rounds.map((r) => r.type).sort().join(",");
    const comps = row.parsed.competencies
      .filter((c) => c.depth === "assessed")
      .map((c) => c.name.toLowerCase())
      .sort()
      .join(",");
    return (
      row.parsed.employerProfile.sector === record.employerProfile.sector &&
      rounds === ownRounds &&
      comps === ownComps &&
      ownComps.length > 0
    );
  });
  if (twin) {
    signals.push({
      signal: "Near-duplicate loop in the published pool",
      severity: "medium",
      evidence: `Same sector, round types and assessed competencies as ${twin.id}.`,
    });
    trace.push(`Flagged near-duplicate of ${twin.id}.`);
  }

  if (record.loopLengthWeeks != null && record.loopLengthWeeks < 2 && record.roundsCleared >= 5) {
    signals.push({
      signal: "Loop length is unusually short for the named rounds",
      severity: "high",
      evidence: `${record.roundsCleared} cleared rounds in ${record.loopLengthWeeks} weeks — already demoted by tier rules; not unpublished.`,
    });
    trace.push("Flagged short loop. Publish decision already made.");
  }

  if (record.evidence === "self_attested") {
    signals.push({
      signal: "Evidence is self-attested",
      severity: "low",
      evidence: "No third party confirmed this loop. The record stays published; a recruiter should still verify.",
    });
    trace.push("Noted self-attested evidence.");
  }

  if (signals.length === 0) {
    trace.push("No pattern flags. Recommendation is clear.");
    return {
      review: {
        signals: [],
        recommendation: "clear",
        reviewerNote: "No pattern flags against the published pool. This inspection cannot un-publish.",
      },
      trace,
    };
  }

  const critical = signals.some((s) => s.severity === "critical" || s.severity === "high");
  return {
    review: {
      signals,
      recommendation: critical ? "hold" : "flag",
      reviewerNote: critical
        ? "A person should look at this. The record is already published; this step does not retract it."
        : "Noted for a person. The record stays in the Circuit.",
    },
    trace,
  };
}
