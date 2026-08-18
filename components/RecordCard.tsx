"use client";

import type { DossierRecord } from "../lib/records";
import { EVIDENCE_LABEL, OUTCOME_LABEL, ROUND_LABEL, describeEmployer, describeScope, freshness } from "../lib/records";
import { Label, TierBadge } from "./primitives";

/**
 * A record as it appears on the Circuit wall.
 *
 * Shows what was tested, how deep the loop went, how confident the structuring
 * was, and how old the evidence is — and nothing that could identify the
 * candidate or the employer, because the projection it reads from doesn't
 * contain any.
 */
export function RecordCard({
  record,
  index = 0,
  isNew,
  onSelect,
}: {
  record: DossierRecord;
  index?: number;
  isNew?: boolean;
  onSelect: (record: DossierRecord) => void;
}) {
  const { parsed } = record;
  const confidence = Math.round(parsed.roundsConfidence * 100);

  return (
    <button
      type="button"
      className={`record-card animate-slide-up${isNew ? " is-new" : ""}`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms`, opacity: 0, animationFillMode: "forwards" }}
      onClick={() => onSelect(record)}
      aria-label={`Open record ${record.id}`}
    >
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 9 }}>
          <span className="mono-sm" style={{ fontWeight: 500 }}>{record.id}</span>
          {isNew && <span className="chip chip-ok">New</span>}
          {record.demo && <span className="chip">Demo data</span>}
        </div>
        <TierBadge tier={record.tier} />
      </div>

      <div className="display-sm" style={{ textTransform: "capitalize", marginBottom: 4 }}>
        {describeEmployer(parsed)}
      </div>
      <div className="label" style={{ marginBottom: 16 }}>
        {describeScope(parsed) || "Scope not stated"}
      </div>

      <div className="row-wrap" style={{ marginBottom: 16 }}>
        {parsed.rounds.map((round) => (
          <span
            key={round.index}
            className="chip"
            style={round.cleared ? undefined : { opacity: 0.5, borderStyle: "dashed" }}
            title={round.cleared ? "Cleared" : "Not cleared"}
          >
            {ROUND_LABEL[round.type] ?? round.type}
          </span>
        ))}
      </div>

      <div className="stack-2" style={{ marginBottom: 14 }}>
        <div className="row-between">
          <span className="label">
            {parsed.roundsCleared} of {parsed.roundsTotal ?? parsed.rounds.length} cleared
          </span>
          <span className="mono-sm" style={{ color: "var(--muted)" }}>{confidence}%</span>
        </div>
        <div className="conf-bar">
          <div className="conf-bar-fill" style={{ width: `${confidence}%` }} />
        </div>
      </div>

      <div className="stack-2">
        <div className="row-between" style={{ gap: 12 }}>
          <Label>Outcome</Label>
          <span className="mono-sm" style={{ textAlign: "right", color: "var(--muted)" }}>
            {OUTCOME_LABEL[parsed.outcome]}
          </span>
        </div>
        <div className="row-between" style={{ gap: 12 }}>
          <Label>Evidence</Label>
          <span className="mono-sm" style={{ color: "var(--muted)" }}>
            {EVIDENCE_LABEL[record.evidence]}
          </span>
        </div>
        <div className="row-between" style={{ gap: 12 }}>
          <Label>Freshness</Label>
          <span className="mono-sm" style={{ color: "var(--muted)" }}>{freshness(record.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}
