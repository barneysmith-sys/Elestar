"use client";

/**
 * The Circuit: the wall of published records.
 *
 * Everything here has cleared redaction. Records that were withheld or need
 * generalising are not filtered out of this view — they were never returned to
 * it, because the query behind it is the same `redaction_decision = 'publish'`
 * condition the RLS policy enforces.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Tier } from "../src/types";
import type { DossierRecord, IntroRequest } from "../lib/records";
import { ROUND_LABEL, TIER_ORDER, describeEmployer } from "../lib/records";
import { EngineBadge, Empty, ErrorNote, Label, SectionHead, StatBlock } from "./primitives";
import { RecordCard } from "./RecordCard";
import { RecordDetail } from "./RecordDetail";

interface CircuitResponse {
  records: DossierRecord[];
  meta: {
    engine: "model" | "deterministic";
    engineLabel: string;
    persistenceLabel: string;
    total: number;
  };
}

/**
 * `initialEngine` is what the server already knows about the deployment. It is
 * passed in so the reasoning label is present in the first paint rather than
 * appearing once the fetch resolves — a disclosure that arrives late is one a
 * reader can miss.
 */
export function CircuitClient({
  initialEngine,
  initialEngineLabel,
}: {
  initialEngine: "model" | "deterministic";
  initialEngineLabel: string;
}) {
  const [data, setData] = useState<CircuitResponse | null>(null);
  const [intros, setIntros] = useState<IntroRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DossierRecord | null>(null);

  const [tier, setTier] = useState<Tier | "all">("all");
  const [sector, setSector] = useState("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [circuitRes, introRes] = await Promise.all([
        fetch("/api/circuit", { cache: "no-store" }),
        fetch("/api/intro", { cache: "no-store" }),
      ]);
      if (!circuitRes.ok) {
        const body = (await circuitRes.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not load the Circuit.");
        return;
      }
      setData((await circuitRes.json()) as CircuitResponse);
      if (introRes.ok) {
        const body = (await introRes.json()) as { intros: IntroRequest[] };
        setIntros(body.intros ?? []);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const records = data?.records ?? [];

  const sectors = useMemo(() => {
    const found = new Set<string>();
    for (const r of records) {
      if (r.parsed.employerProfile.sector) found.add(r.parsed.employerProfile.sector);
    }
    return [...found].sort();
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (tier !== "all" && r.tier !== tier) return false;
      if (sector !== "all" && r.parsed.employerProfile.sector !== sector) return false;
      if (!q) return true;
      const haystack = [
        r.id,
        describeEmployer(r.parsed),
        ...r.parsed.competencies.map((c) => c.name),
        ...r.parsed.rounds.map((round) => ROUND_LABEL[round.type] ?? round.type),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [records, tier, sector, query]);

  const stats = useMemo(() => {
    const competencies = new Set<string>();
    let assessed = 0;
    let rounds = 0;
    for (const r of records) {
      rounds += r.parsed.rounds.length;
      for (const c of r.parsed.competencies) {
        competencies.add(c.name);
        if (c.depth === "assessed") assessed++;
      }
    }
    return { competencies: competencies.size, assessed, rounds };
  }, [records]);

  const introFor = useCallback(
    (recordId: string) => intros.find((i) => i.dossierId === recordId) ?? null,
    [intros],
  );

  return (
    <div className="wrap section">
      <SectionHead
        kicker="Circuit"
        title="Verified interview records"
        sub="Work that was tested, how far a loop got, and why that claim is trusted. Identity, recruiter mail, and company names stay off this wall."
        right={
          <EngineBadge
            engine={data?.meta.engine ?? initialEngine}
            label={data?.meta.engineLabel ?? initialEngineLabel}
          />
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {!error && (
        <>
          <div className="cols-4" style={{ marginBottom: 40 }}>
            <StatBlock value={records.length} label="Published records" hint="Cleared the privacy audit" />
            <StatBlock value={stats.rounds} label="Interview rounds" hint="Structured from descriptions" />
            <StatBlock value={stats.competencies} label="Distinct competencies" hint="Drawn from what was tested" />
            <StatBlock value={stats.assessed} label="Assessed at depth" hint="A full round was dedicated to it" />
          </div>

          <div
            className="row-between stack-mobile"
            style={{ gap: 16, paddingBottom: 20, marginBottom: 24, borderBottom: "1px solid var(--border)" }}
          >
            <div className="row-wrap" style={{ gap: 12, alignItems: "center" }}>
              <div className="seg">
                <button type="button" className={tier === "all" ? "active" : ""} onClick={() => setTier("all")}>
                  All tiers
                </button>
                {TIER_ORDER.map((t) => (
                  <button key={t} type="button" className={tier === t ? "active" : ""} onClick={() => setTier(t)}>
                    {t}
                  </button>
                ))}
              </div>

              {sectors.length > 0 && (
                <select
                  className="field"
                  style={{ width: "auto", padding: "8px 34px 8px 12px", fontSize: 12 }}
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  aria-label="Filter by sector"
                >
                  <option value="all">All sectors</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, "/")}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <input
              type="search"
              className="field"
              style={{ maxWidth: 300, padding: "9px 12px", fontSize: 13 }}
              placeholder="Filter by competency, round, id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter records"
            />
          </div>

          <div className="row-between" style={{ marginBottom: 20 }}>
            <Label>
              {loading
                ? "Loading…"
                : `${filtered.length} of ${records.length} record${records.length === 1 ? "" : "s"}`}
            </Label>
            {data && <Label>{data.meta.persistenceLabel}</Label>}
          </div>

          {loading && (
            <div className="grid-cards">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="card animate-pulse-ink"
                  style={{ height: 268, animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && records.length > 0 && (
            <Empty
              title="No records match those filters"
              body="Try clearing the tier or sector filter, or searching for a different competency."
              action={
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setTier("all");
                    setSector("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </button>
              }
            />
          )}

          {!loading && records.length === 0 && (
            <Empty
              title="The Circuit is empty"
              body="No record has cleared the privacy audit yet. List a process to put the first one through the pipeline."
              action={
                <a href="/list" className="btn-primary btn-sm" style={{ textDecoration: "none" }}>
                  List a process
                </a>
              }
            />
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid-cards">
              {filtered.map((record, i) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  index={i}
                  isNew={!record.demo}
                  onSelect={setSelected}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <RecordDetail
          record={selected}
          intro={introFor(selected.id)}
          roleDescription={`Hiring for a role like ${describeEmployer(selected.parsed)}`}
          onClose={() => setSelected(null)}
          onIntroChange={(intro) =>
            setIntros((prev) => [intro, ...prev.filter((i) => i.id !== intro.id)])
          }
        />
      )}
    </div>
  );
}
