"use client";

import type { AuditStepData, IdentifyStepData, MatchStepData, ResearchStepData } from "../../../lib/pipelineWire";

export function PipelineEvidence({
  identify,
  research,
  match,
  audit,
}: {
  identify?: IdentifyStepData;
  research?: ResearchStepData;
  match?: MatchStepData;
  audit?: AuditStepData;
}) {
  if (!identify && !research && !match && !audit) return null;

  return (
    <div className="mt-6 space-y-5">
      {research && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-3)" }}>
          {research.overall ? `${research.overall} · ` : ""}
          {research.independentSources != null ? `${research.independentSources} independent · ` : ""}
          {research.evidence.length} source{research.evidence.length === 1 ? "" : "s"}
        </p>
      )}
      {research?.conflicts && research.conflicts.length > 0 && (
        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Conflict preserved: {research.conflicts.join(" ")}
        </p>
      )}
      {research && research.evidence.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--navy)" }}>
            Evidence · {research.evidenceKind}
          </p>
          <ul className="space-y-2">
            {research.evidence.map((item) => (
              <li key={item.id} className="text-[13px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {item.claim}
                <span className="font-mono text-[10px] uppercase ml-2">{item.kind === "live_public" ? "live" : "catalog"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {match?.verification.claims && match.verification.claims.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--navy)" }}>
            Claims · weakest important decides
          </p>
          <ul className="space-y-1.5">
            {match.verification.claims.map((claim) => (
              <li key={claim.id} className="flex gap-2 text-[13px]">
                <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: claim.status === "verified" || claim.status === "probable" ? "var(--verify)" : "var(--ink-3)" }}>
                  {claim.status}
                </span>
                <span>{claim.label}{claim.important ? "" : " · optional"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {match?.verification.checks && match.verification.checks.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--navy)" }}>
            Checks · {Math.round(match.verification.confidence * 100)}%
          </p>
          <ul className="space-y-1.5">
            {match.verification.checks.map((check) => (
              <li key={check.id} className="flex gap-2 text-[13px]">
                <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: check.pass ? "var(--verify)" : "var(--ink-3)" }}>
                  {check.pass ? "pass" : "hold"}
                </span>
                <span>{check.label}</span>
              </li>
            ))}
          </ul>
          {match.verification.inconsistencies.length > 0 && (
            <p className="text-[13px] mt-3" style={{ color: "var(--muted-foreground)" }}>
              {match.verification.inconsistencies.join(" ")}
            </p>
          )}
        </div>
      )}
      {audit && (
        <p className="font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>
          k={audit.cohortCount} · floor {audit.kFloor} · {audit.audit.decision}
        </p>
      )}
    </div>
  );
}
