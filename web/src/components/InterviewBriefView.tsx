"use client";

import type { ReactNode } from "react";
import type { AnnotatedBrief } from "../../../lib/reasoners/brief";

export function InterviewBriefView({ brief }: { brief: AnnotatedBrief }) {
  const known = brief.facts.filter((f) => f.provenance === "known");
  const uncertain = brief.facts.filter((f) => f.provenance === "unknown" || f.provenance === "inferred");
  return (
    <div className="space-y-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-3)" }}>
        Confidence {Math.round(brief.confidence * 100)}% · grounded in the verified record
      </p>
      <Section title="What we know">
        {known.length ? (
          <ul className="space-y-2">
            {known.map((f) => (
              <li key={f.claim} className="text-[15px] leading-relaxed">
                {f.claim}
                <span className="block text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{f.basis}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px]" style={{ color: "var(--muted-foreground)" }}>Nothing on this record is known at assessed depth.</p>
        )}
      </Section>
      <Section title="Why it matters">
        <ul className="space-y-2">
          {brief.alreadyAssessed.map((a) => (
            <li key={a.competency} className="text-[15px]">
              {a.competency}
              <span className="font-mono text-[10px] uppercase tracking-wide ml-2" style={{ color: "var(--muted-foreground)" }}>{a.depth} · {a.format}</span>
            </li>
          ))}
          {brief.safeToSkip.map((s) => (
            <li key={s.round} className="text-[15px]">
              Skip {s.round}
              <span className="block text-[13px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.redundantWith}</span>
            </li>
          ))}
          {!brief.alreadyAssessed.length && !brief.safeToSkip.length && (
            <p className="text-[15px]" style={{ color: "var(--muted-foreground)" }}>No transferable assessment is claimed.</p>
          )}
        </ul>
      </Section>
      <Section title="What is uncertain">
        <ul className="space-y-2">
          {uncertain.map((f) => (
            <li key={`${f.provenance}-${f.claim}`} className="text-[15px] leading-relaxed">
              <span className="font-mono text-[10px] uppercase tracking-wide mr-2" style={{ color: "var(--ink-3)" }}>{f.provenance}</span>
              {f.claim}
            </li>
          ))}
          <li className="text-[15px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{brief.outcomeContext}</li>
        </ul>
      </Section>
      <Section title="What to do next">
        <ul className="space-y-2">
          {brief.probeInstead.map((p) => <li key={p} className="text-[15px]">{p}</li>)}
        </ul>
        <p className="text-[14px] mt-3" style={{ color: "var(--muted-foreground)" }}>Never skip: {brief.neverSkip.join(" · ")}</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--navy)" }}>{title}</p>
      {children}
    </div>
  );
}
