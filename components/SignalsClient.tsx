"use client";

/**
 * Signals: aggregate intelligence over published, anonymous interview records.
 *
 * Every figure is counted from Circuit records. Demo seeds are labelled.
 * Company names are not stored, so the company-type filter is sector.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROUND_LABEL } from "../lib/records";
import type { SignalsReport } from "../lib/signals";
import { EngineBadge, ErrorNote, Label, SectionHead } from "./primitives";

interface SignalsResponse {
  report: SignalsReport;
  meta: { engine: "model" | "deterministic"; engineLabel: string; persistenceLabel: string };
}

const DAY_OPTIONS = [
  { id: "", label: "All time" },
  { id: "45", label: "Last 45 days" },
  { id: "90", label: "Last 90 days" },
];

export function SignalsClient({
  initialEngine,
  initialEngineLabel,
}: {
  initialEngine: "model" | "deterministic";
  initialEngineLabel: string;
}) {
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [round, setRound] = useState("");
  const [competency, setCompetency] = useState("");
  const [role, setRole] = useState("");
  const [days, setDays] = useState("");
  const [excludeDemo, setExcludeDemo] = useState(false);
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (sector) params.set("sector", sector);
    if (stage) params.set("stage", stage);
    if (round) params.set("round", round);
    if (competency) params.set("competency", competency);
    if (role) params.set("role", role);
    if (days) params.set("days", days);
    if (excludeDemo) params.set("excludeDemo", "true");
    const qs = params.toString();
    return qs ? `/api/signals?${qs}` : "/api/signals";
  }, [sector, stage, round, competency, role, days, excludeDemo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(query, { cache: "no-store" });
      if (!res.ok) {
        setError("Signals could not be loaded.");
        setData(null);
        return;
      }
      setData((await res.json()) as SignalsResponse);
    } catch {
      setError("Lost connection while loading signals.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const report = data?.report;
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
    <div className="wrap section">
      <SectionHead
        kicker="Signals"
        title="Elestar is learning how hiring actually works"
        sub="Verified loops, aggregated. Competencies, stages, and process patterns — never a person, a recruiter, or a company name."
        right={
          <EngineBadge
            engine={data?.meta.engine ?? initialEngine}
            label={data?.meta.engineLabel ?? initialEngineLabel}
          />
        }
      />

      <div className="card-flat stack-4" style={{ marginBottom: 40 }}>
        <div className="row-wrap" style={{ gap: 10 }}>
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
          <FilterSelect label="Time" value={days} onChange={setDays} options={DAY_OPTIONS.map((d) => d.id)} labels={Object.fromEntries(DAY_OPTIONS.map((d) => [d.id, d.label]))} />
        </div>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={excludeDemo} onChange={(e) => setExcludeDemo(e.target.checked)} />
          <span className="body-sm">Exclude demo seeds</span>
        </label>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {report && (
        <div className="stack-8">
          <div className="cols-4">
            <Stat n={report.pool} label="Records in view" />
            <Stat n={report.corroborated} label="Corroborated" />
            <Stat n={report.meanRounds ?? 0} label="Avg. stages" suffix={report.meanRounds === null ? "—" : report.meanRounds.toFixed(1)} />
            <Stat n={report.medianLoopWeeks ?? 0} label="Median weeks" suffix={report.medianLoopWeeks === null ? "—" : undefined} />
          </div>

          {report.demoCount > 0 && (
            <p className="body-sm" style={{ fontSize: 12 }}>
              {report.demoCount} of {report.pool} records in this view are demo seeds, marked as such on Circuit. They are the same anonymous objects Search uses.
            </p>
          )}

          {report.trending.length > 0 && (
            <section className="stack-4">
              <Label>Trending signals</Label>
              <div className="stack-3">
                {report.trending.map((claim, i) => (
                  <article
                    key={claim.id}
                    className="card stack-2 animate-slide-up"
                    style={{ animationDelay: `${i * 80}ms`, opacity: 0, animationFillMode: "forwards" }}
                  >
                    <p className="body-text">{claim.claim}</p>
                    <span className="mono-sm" style={{ color: "var(--muted)" }}>{claim.basis}</span>
                    {claim.share !== null && (
                      <div className="conf-bar">
                        <div
                          className="conf-bar-fill"
                          style={{ width: `${Math.round(claim.share * 100)}%`, transitionDelay: `${i * 90}ms` }}
                        />
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="split" style={{ gap: 40 }}>
            <ShareList title="Competencies" rows={report.competencies.slice(0, 10)} />
            <ShareList title="Interview stages" rows={report.rounds} labelFor={(name) => ROUND_LABEL[name] ?? name} />
          </div>

          <div className="cols-3" style={{ gap: 40 }}>
            <ShareList title="Company type" rows={report.sectors} />
            <ShareList title="Role family" rows={report.roles} />
            <ShareList title="Company stage" rows={report.stages} />
          </div>

          {!report.eligible && !loading && (
            <p className="lede">No published records match these filters. Nothing is invented to fill the gap.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, hint, suffix }: { n: number; label: string; hint?: string; suffix?: string }) {
  return (
    <div className="stack-2">
      <Label>{label}</Label>
      <span className="ticker display-md">{suffix ?? n}</span>
      {hint && <span className="mono-sm" style={{ color: "var(--muted)" }}>{hint}</span>}
    </div>
  );
}

function ShareList({
  title,
  rows,
  labelFor,
}: {
  title: string;
  rows: { name: string; count: number; share: number }[];
  labelFor?: (name: string) => string;
}) {
  return (
    <section className="stack-3">
      <Label>{title}</Label>
      {rows.length === 0 ? (
        <p className="body-sm">None in this view.</p>
      ) : (
        <div className="stack-3">
          {rows.map((row, i) => (
            <div key={row.name} className="stack-2 animate-slide-up" style={{ animationDelay: `${i * 50}ms`, opacity: 0, animationFillMode: "forwards" }}>
              <div className="row-between">
                <span className="body-text">{(labelFor?.(row.name) ?? row.name).replace(/_/g, " ")}</span>
                <span className="mono-sm">{Math.round(row.share * 100)}% · {row.count}</span>
              </div>
              <div className="conf-bar">
                <div className="conf-bar-fill" style={{ width: `${Math.round(row.share * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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
    <label className="stack-2" style={{ minWidth: 140 }}>
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((opt) => (
          <option key={opt || "all"} value={opt}>
            {labels?.[opt] ?? (opt ? opt.replace(/_/g, " ") : "All")}
          </option>
        ))}
      </select>
    </label>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
