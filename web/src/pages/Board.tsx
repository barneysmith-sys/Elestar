"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "../components/AppNav";
import DepthGlyph from "../components/DepthGlyph";
import VerifyRound from "../components/VerifyRound";
import { fetchCircuit, requestIntro } from "../elestar-api";
import { publicRoundLabel, roundKind } from "../lib/rounds";
import { useRouter } from "../router";
import type { DossierRecord } from "../../../lib/records";
import { describeEmployer, describeScope, furthestRoundLabel, TIER_MEANING } from "../../../lib/records";

const TIER_FILTERS = ["All", "apex", "elite", "verified", "standard"] as const;

function recencyLabel(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return "";
  if (days < 7) return "this week";
  if (days < 45) return "recent";
  return "";
}

function RecordModal({
  record,
  onClose,
  onIntro,
}: {
  record: DossierRecord;
  onClose: () => void;
  onIntro: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(21, 34, 56, 0.42)" }} />
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto"
        style={{ background: "var(--card)", color: "var(--card-foreground)", boxShadow: "var(--paper-shadow)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 border-b px-6 py-4 flex items-center justify-between" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-0.5" style={{ color: "var(--muted-foreground)" }}>
              Anonymous record
            </p>
            <h3 className="font-display font-normal text-xl">{record.id}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 grid place-items-center font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
            Close
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {record.demo && (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-3)" }}>Seeded demo record · not a live submission</p>
          )}
          <div>
            <p className="font-display font-normal text-[18px]" style={{ color: "var(--navy)" }}>{describeEmployer(record.parsed)}</p>
            <p className="font-mono text-[11px] mt-1 uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
              {furthestRoundLabel(record.parsed)} · {record.tier} · {TIER_MEANING[record.tier]}
            </p>
            {describeScope(record.parsed) && (
              <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>{describeScope(record.parsed)}</p>
            )}
          </div>
          <div className="space-y-2">
            {record.parsed.rounds.map((round) => (
              <div key={`${round.index}-${round.label}`} className="border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-[16px]">{round.label}</p>
                  <span className="font-mono text-[10px] uppercase" style={{ color: "var(--muted-foreground)" }}>
                    {String(round.index).padStart(2, "0")} · {round.cleared ? "cleared" : "named"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {record.parsed.competencies.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--navy)" }}>Tested</p>
              <p className="text-[14px]" style={{ color: "var(--foreground)" }}>
                {record.parsed.competencies.map((c) => `${c.name} (${c.depth})`).join(" · ")}
              </p>
            </div>
          )}
          {record.audit && (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-3)" }}>
              Privacy · {record.audit.decision} · k={record.audit.kAnonymity}
            </p>
          )}
          <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-3)" }}>
            {record.evidence} · {record.tier}
            {recencyLabel(record.createdAt) ? ` · ${recencyLabel(record.createdAt)}` : ""}
          </p>
          <button
            type="button"
            onClick={onIntro}
            className="w-full font-mono text-[11px] uppercase tracking-[0.12em] py-3 text-[var(--primary-foreground)]"
            style={{ background: "var(--navy)" }}
          >
            Request intro
          </button>
        </div>
      </div>
    </div>
  );
}

function PinCard({
  record,
  onOpen,
}: {
  record: DossierRecord;
  onOpen: () => void;
}) {
  const round = furthestRoundLabel(record.parsed);
  const kind = roundKind(round);
  return (
    <li className="wall-card">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="work-field" aria-hidden="true">
          <div className="work-field-grain" />
        </div>
        <dl className="record record-tight">
          <div className="record-row">
            <dt className="type-label">Company</dt>
            <dd className="type-value">{describeEmployer(record.parsed)}</dd>
          </div>
          <div className="record-row">
            <dt className="type-label">Round</dt>
            <dd className="type-value wall-round">
              <DepthGlyph kind={kind} />
              <span>{publicRoundLabel(round)}</span>
            </dd>
          </div>
        </dl>
        <p className="type-caption" style={{ marginTop: 8 }}>
          {record.tier}
          {record.demo ? " · demo" : ""} · {record.evidence}
        </p>
      </button>
    </li>
  );
}

export default function Board() {
  const { showToast } = useRouter();
  const [records, setRecords] = useState<DossierRecord[]>([]);
  const [metaLabel, setMetaLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [committed, setCommitted] = useState("");
  const [filter, setFilter] = useState<(typeof TIER_FILTERS)[number]>("All");
  const [verify, setVerify] = useState(false);
  const [modal, setModal] = useState<DossierRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchCircuit()
      .then((data) => {
        if (cancelled) return;
        setRecords(data.records);
        setMetaLabel(`${data.meta.persistenceLabel} · ${data.meta.engineLabel}`);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Circuit could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo(() => {
    const words = (committed.toLowerCase().match(/[a-z0-9-]+/g) ?? []);
    return records.filter((record) => {
      if (filter !== "All" && record.tier !== filter) return false;
      if (!words.length) return true;
      const hay = `${record.id} ${describeEmployer(record.parsed)} ${furthestRoundLabel(record.parsed)} ${record.parsed.competencies.map((c) => c.name).join(" ")}`.toLowerCase();
      return words.some((w) => hay.includes(w));
    });
  }, [records, committed, filter]);

  return (
    <div className="site" data-page="board">
      <AppNav />
      <section className="hero hero-solo">
        <div className="hero-copy">
          <h1 className="type-hero">The wall.</h1>
          <p className="type-lede">
            Anonymous verified loops. Privacy already applied. Identity only after an approved intro.
          </p>
        </div>
      </section>

      <div className="sticky z-30 border-y" style={{ top: 58, background: "color-mix(in srgb, var(--background) 88%, transparent)", borderColor: "var(--border)" }}>
        <div className="max-w-[1440px] mx-auto px-5 md:px-7 py-2.5 flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 border px-3 py-1.5 min-w-[220px] flex-1 max-w-[420px]" style={{ borderColor: "var(--border)" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setCommitted(query.trim()); }}
              placeholder="Backend. Series B. System design."
              className="flex-1 bg-transparent outline-none text-[14px] py-0.5"
              style={{ color: "var(--foreground)" }}
            />
            <button type="button" onClick={() => setCommitted(query.trim())} className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--navy)" }}>
              Filter
            </button>
          </div>
          {TIER_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="flex-none font-mono text-[11px] uppercase tracking-[0.1em] px-3 py-1.5"
              style={{
                background: filter === f ? "var(--navy)" : "transparent",
                color: filter === f ? "var(--primary-foreground)" : "var(--navy)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-5 md:px-7 pt-4">
        <p className="font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {loading ? "Reading the wall." : error ? error : `${list.length} records · ${metaLabel}`}
        </p>
        <button
          type="button"
          onClick={() => setVerify(true)}
          className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-[0.1em]"
          style={{ color: "var(--navy)" }}
        >
          Add an interview
        </button>
      </div>

      <main className="site-section">
        <div className="wall-scroll">
          <ul className="wall-grid">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="wall-card">
                    <div className="work-field" aria-hidden="true">
                      <div className="work-field-grain" />
                    </div>
                  </li>
                ))
              : list.map((record) => (
                  <PinCard key={record.rowId} record={record} onOpen={() => setModal(record)} />
                ))}
          </ul>
        </div>
      </main>

      {!loading && !list.length && !error && (
        <p className="max-w-[1440px] mx-auto px-5 md:px-7 mb-[90px] text-[15px]" style={{ color: "var(--muted-foreground)" }}>
          No published records yet. Forward a recruiter email to prove@elestar.ai, or simulate an inbound on Verify.
        </p>
      )}

      <VerifyRound open={verify} onClose={() => setVerify(false)} />
      {modal && (
        <RecordModal
          record={modal}
          onClose={() => setModal(null)}
          onIntro={() => {
            void requestIntro(modal.id, "Open intro from the wall.")
              .then(() => showToast("Intro requested. Nothing is revealed until they approve."))
              .catch((err: unknown) => showToast(err instanceof Error ? err.message : "Intro request failed."));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
