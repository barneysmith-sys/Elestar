"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "../components/AppNav";
import { fetchSignals } from "../elestar-api";
import { ROUND_LABEL } from "../../../lib/records";
import type { SignalsReport } from "../../../lib/signals";

const DAY_OPTIONS = [
  { id: "", label: "All time" },
  { id: "45", label: "Last 45 days" },
  { id: "90", label: "Last 90 days" },
];

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export default function Signals() {
  const [report, setReport] = useState<SignalsReport | null>(null);
  const [engine, setEngine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState("");
  const [role, setRole] = useState("");
  const [stage, setStage] = useState("");
  const [round, setRound] = useState("");
  const [competency, setCompetency] = useState("");
  const [days, setDays] = useState("");
  const [excludeDemo, setExcludeDemo] = useState(false);

  const params = useMemo(() => {
    const next: Record<string, string> = {};
    if (sector) next.sector = sector;
    if (role) next.role = role;
    if (stage) next.stage = stage;
    if (round) next.round = round;
    if (competency) next.competency = competency;
    if (days) next.days = days;
    if (excludeDemo) next.excludeDemo = "true";
    return next;
  }, [sector, role, stage, round, competency, days, excludeDemo]);

  useEffect(() => {
    let cancelled = false;
    void fetchSignals(params)
      .then((data) => {
        if (cancelled) return;
        setReport(data.report);
        setEngine(data.meta.engineLabel);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Signals could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const facets = useMemo(() => {
    if (!report) return { sectors: [], stages: [], rounds: [], competencies: [], roles: [] };
    return {
      sectors: report.sectors.map((s) => s.name),
      stages: report.stages.map((s) => s.name),
      rounds: report.rounds.map((s) => s.name),
      competencies: report.competencies.map((s) => s.name),
      roles: report.roles.map((s) => s.name),
    };
  }, [report]);

  return (
    <div style={{ minHeight: "100dvh" }}>
      <AppNav />
      <div className="max-w-[1100px] mx-auto px-5 md:px-7 pt-10 pb-[90px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Signals</p>
        <h1 className="font-display font-extralight leading-none mb-4" style={{ fontSize: "clamp(2.6rem, 6.5vw, 4.8rem)", letterSpacing: "-0.045em", color: "var(--navy)" }}>
          What the pool is teaching.
        </h1>
        <p className="text-[16px] max-w-[46ch] mb-8" style={{ color: "var(--muted-foreground)" }}>
          Counted only from records that already cleared publication. Every claim below has a basis. Company names are not an input.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <FilterSelect label="Company type" value={sector} onChange={setSector} options={unique(["", ...facets.sectors, sector])} />
          <FilterSelect label="Role family" value={role} onChange={setRole} options={unique(["", ...facets.roles, role])} />
          <FilterSelect label="Stage" value={stage} onChange={setStage} options={unique(["", ...facets.stages, stage])} />
          <FilterSelect
            label="Interview stage"
            value={round}
            onChange={setRound}
            options={unique(["", ...facets.rounds, round])}
            labels={Object.fromEntries(facets.rounds.map((r) => [r, ROUND_LABEL[r] ?? r]))}
          />
          <FilterSelect label="Competency" value={competency} onChange={setCompetency} options={unique(["", ...facets.competencies.slice(0, 16), competency])} />
          <FilterSelect
            label="Time"
            value={days}
            onChange={setDays}
            options={DAY_OPTIONS.map((d) => d.id)}
            labels={Object.fromEntries(DAY_OPTIONS.map((d) => [d.id, d.label]))}
          />
        </div>

        <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] mb-8">
          <input type="checkbox" checked={excludeDemo} onChange={(e) => setExcludeDemo(e.target.checked)} />
          Exclude seeded demo records
        </label>
        {error && <p>{error}</p>}
        {report && (
          <>
            <p className="font-mono text-[11px] mb-8" style={{ color: "var(--ink-3)" }}>
              {report.published} published · {report.demoCount} demo · {engine}
              {report.eligible ? "" : " · pool below the public-signal floor"}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <Stat n={report.pool} label="Records in view" />
              <Stat n={report.corroborated} label="Corroborated" />
              <Stat n={report.meanRounds ?? 0} label="Avg. stages" display={report.meanRounds === null ? "—" : report.meanRounds.toFixed(1)} />
              <Stat n={report.medianLoopWeeks ?? 0} label="Median weeks" display={report.medianLoopWeeks === null ? "—" : String(report.medianLoopWeeks)} />
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <ShareList title="Competencies" rows={report.competencies} />
              <ShareList title="Rounds" rows={report.rounds} labels={ROUND_LABEL} />
              <ShareList title="Sectors" rows={report.sectors} />
              <ShareList title="Stages" rows={report.stages} />
              <ShareList title="Role families" rows={report.roles} />
            </div>
            {report.trending.length > 0 && (
              <div className="mt-12">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-4" style={{ color: "var(--navy)" }}>Trending claims</p>
                <ul className="space-y-4">
                  {report.trending.map((t) => (
                    <li key={t.id}>
                      <p className="font-display text-[20px]" style={{ color: "var(--navy)" }}>{t.claim}</p>
                      <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>{t.basis}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label, display }: { n: number; label: string; display?: string }) {
  return (
    <div className="border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-display text-[28px] leading-none" style={{ color: "var(--navy)" }}>{display ?? n}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] mt-2" style={{ color: "var(--muted-foreground)" }}>{label}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.14em] mb-1.5" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border px-3 py-2 text-[13px] bg-transparent"
        style={{ borderColor: "var(--border-2)", color: "var(--foreground)" }}
      >
        {options.map((opt) => (
          <option key={opt || "all"} value={opt}>{opt === "" ? "All" : (labels?.[opt] ?? opt.replace(/_/g, " "))}</option>
        ))}
      </select>
    </label>
  );
}

function ShareList({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: { name: string; count: number; share: number }[];
  labels?: Record<string, string>;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>{title}</p>
      {!rows.length && <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>None yet.</p>}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.name} className="flex justify-between gap-4 border-b pb-2" style={{ borderColor: "var(--border)" }}>
            <span className="text-[15px]">{labels?.[row.name] ?? row.name.replace(/_/g, " ")}</span>
            <span className="font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>{row.count} · {Math.round(row.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
