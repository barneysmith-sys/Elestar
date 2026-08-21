"use client";

const AGENTS = [
  { name: "Receive", does: "Accepts a forward at prove@elestar.ai. Demo simulates the same inbound. Raw mail never becomes public.", kind: "Always real" },
  { name: "Parse mail", does: "Splits the thread, reads SPF/DKIM/DMARC from Authentication-Results, never invents a pass.", kind: "Always real" },
  { name: "Identify", does: "Company domain, role, and how far the loop got. Tier from rounds cleared.", kind: "Judgement" },
  { name: "Plan", does: "Chooses catalog tools, holds unknown domains, refuses lookalikes. Re-plans after research.", kind: "Always real" },
  { name: "Research", does: "Public catalog evidence for the sender domain. Labelled catalog, not a live crawl.", kind: "Always real" },
  { name: "Cross-check", does: "Mail vs stated experience vs public evidence. Failed verification never publishes.", kind: "Judgement" },
  { name: "Privacy audit", does: "Scores re-identification risk and enforces a k=8 cohort floor. Fails closed.", kind: "Judgement" },
  { name: "Publish", does: "Writes the anonymised projection. Identity has no column to live in.", kind: "Always real" },
  { name: "Place", does: "Puts the record on the Circuit from overlapping sector and competency evidence only.", kind: "Always real" },
  { name: "Pattern review", does: "Inspects the published pool. Flags never un-publish. A person still decides.", kind: "Always real" },
  { name: "Hire Scout", does: "Ranks published records against a role in sentences. Never invents a skipped round.", kind: "Judgement" },
  { name: "Signals", does: "Aggregates published loops into what companies are actually testing.", kind: "Always real" },
  { name: "Brief", does: "Separates known from inferred from unknown. Only after an approved intro.", kind: "Judgement" },
] as const;

export function AgentRoster() {
  return (
    <div className="mt-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>
        Agents on this product
      </p>
      <p className="text-[15px] leading-relaxed max-w-[58ch] mb-8" style={{ color: "var(--muted-foreground)" }}>
        Verify is the centerpiece. The rest of the product reads from the same published pool — Circuit, Search, Signals, Intros, Brief — rather than a second mock pipeline.
      </p>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {AGENTS.map((agent) => (
          <div key={agent.name} className="py-4 grid md:grid-cols-[0.28fr_0.18fr_0.54fr] gap-3">
            <p className="font-display text-[18px]" style={{ color: "var(--navy)" }}>{agent.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] pt-1.5" style={{ color: "var(--ink-3)" }}>{agent.kind}</p>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{agent.does}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
