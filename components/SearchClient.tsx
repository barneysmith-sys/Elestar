"use client";

/**
 * Search and match against the intelligence pool.
 *
 * The result set is produced by the matcher, and every score is broken down
 * into the four components that made it, because a fit score a recruiter can't
 * interrogate is just a number. Each result also names what the record does
 * NOT establish — the schema requires at least one gap, on the grounds that a
 * rationale with no gap is a sales pitch.
 */

import { useCallback, useState } from "react";
import type { MatchResult } from "../src/types";
import type { DossierRecord, IntroRequest } from "../lib/records";
import { DEPTH_LABEL, ROUND_LABEL, describeEmployer, describeScope, freshness, furthestRoundLabel } from "../lib/records";
import { EngineBadge, Empty, ErrorNote, Label, SectionHead, TierBadge } from "./primitives";
import { RecordDetail } from "./RecordDetail";

const EXAMPLES = [
  "Senior backend engineer at a Series B fintech",
  "Staff engineer, distributed systems and system design",
  "Senior engineer with take-home and system design signal",
  "Engineering manager, marketplace, leadership assessed",
];

interface SearchResult {
  match: MatchResult;
  record: DossierRecord;
}

interface SearchResponse {
  results: SearchResult[];
  meta: {
    engine: "model" | "deterministic";
    engineLabel: string;
    pool: number;
    trace: string[];
  };
}

/** See CircuitClient: the engine label is server-known so it lands in first paint. */
export function SearchClient({
  initialEngine,
  initialEngineLabel,
}: {
  initialEngine: "model" | "deterministic";
  initialEngineLabel: string;
}) {
  const [role, setRole] = useState(EXAMPLES[0]!);
  const [submitted, setSubmitted] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DossierRecord | null>(null);
  const [intros, setIntros] = useState<IntroRequest[]>([]);

  const search = useCallback(async () => {
    const trimmed = role.trim();
    if (!trimmed) return;

    setSearching(true);
    setError(null);
    setSubmitted(trimmed);

    try {
      const [res, introRes] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: trimmed }),
        }),
        fetch("/api/intro", { cache: "no-store" }),
      ]);

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Search failed.");
        setData(null);
        return;
      }
      setData((await res.json()) as SearchResponse);
      if (introRes.ok) {
        const body = (await introRes.json()) as { intros: IntroRequest[] };
        setIntros(body.intros ?? []);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSearching(false);
    }
  }, [role]);

  return (
    <div className="wrap section">
      <SectionHead
        kicker="Search"
        title="See what was already evaluated"
        sub="Describe the role. Results lead with competencies that were actually tested, then verified interview stage. Identity stays hidden until they approve an intro."
        right={
          <EngineBadge
            engine={data?.meta.engine ?? initialEngine}
            label={data?.meta.engineLabel ?? initialEngineLabel}
          />
        }
      />

      <form
        className="stack-4"
        style={{ marginBottom: 40 }}
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="row" style={{ gap: 12, alignItems: "stretch" }}>
          <input
            type="text"
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={searching}
            maxLength={2000}
            placeholder="Senior backend engineer at a Series B fintech"
            aria-label="Role description"
          />
          <button type="submit" className="btn-primary" disabled={searching || !role.trim()}>
            {searching ? "Matching…" : "Search"}
          </button>
        </div>

        <div className="row-wrap">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="chip hoverable"
              style={{ cursor: "pointer" }}
              disabled={searching}
              onClick={() => setRole(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {error && <ErrorNote>{error}</ErrorNote>}

      {searching && (
        <div className="stack-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="card animate-pulse-ink"
              style={{ height: 172, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}

      {!searching && data && (
        <div className="stack-6">
          <div className="row-between stack-mobile" style={{ gap: 12 }}>
            <Label>
              {data.results.length} match{data.results.length === 1 ? "" : "es"} from a pool of {data.meta.pool}
            </Label>
            {data.meta.trace.length > 0 && (
              <details>
                <summary className="link-quiet" style={{ cursor: "pointer", listStyle: "none" }}>
                  How this was scored
                </summary>
                <ul className="stack-2" style={{ listStyle: "none", paddingTop: 12, maxWidth: "70ch" }}>
                  {data.meta.trace.map((line, i) => (
                    <li key={i} className="mono-sm" style={{ color: "var(--muted)" }}>
                      {line}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {data.results.length === 0 ? (
            <Empty
              title="Nothing in the pool matches that"
              body="The pool is small by design — every record has to clear a k-anonymity floor before it can be published. Try a broader role description."
            />
          ) : (
            <div className="stack-4">
              {data.results.map(({ match, record }, i) => (
                <ResultCard
                  key={record.id}
                  match={match}
                  record={record}
                  index={i}
                  query={submitted}
                  onOpen={() => setSelected(record)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <RecordDetail
          record={selected}
          intro={intros.find((intro) => intro.dossierId === selected.id) ?? null}
          roleDescription={submitted || role}
          onClose={() => setSelected(null)}
          onIntroChange={(intro) =>
            setIntros((prev) => [intro, ...prev.filter((existing) => existing.id !== intro.id)])
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const COMPONENT_LABEL: Record<keyof MatchResult["components"], string> = {
  competencyOverlap: "Competency overlap",
  processSimilarity: "Process similarity",
  seniorityAlignment: "Seniority alignment",
  recency: "Recency",
};

function ResultCard({
  match,
  record,
  index,
  query,
  onOpen,
}: {
  match: MatchResult;
  record: DossierRecord;
  index: number;
  query: string;
  onOpen: () => void;
}) {
  return (
    <article
      className="card stack-6 animate-slide-up"
      style={{ animationDelay: `${index * 90}ms`, opacity: 0, animationFillMode: "forwards" }}
    >
      <div className="row-between stack-mobile" style={{ alignItems: "flex-start", gap: 20 }}>
        <div className="stack-2" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="mono-sm" style={{ fontWeight: 500 }}>{record.id}</span>
            <TierBadge tier={record.tier} />
            {record.demo && <span className="chip">Demo data</span>}
          </div>
          <h3 className="display-sm" style={{ textTransform: "capitalize" }}>{describeEmployer(record.parsed)}</h3>
          <div className="label">
            Reached {furthestRoundLabel(record.parsed)} · {record.parsed.rounds.length} stages · {freshness(record.createdAt)}
          </div>
          <p className="body-sm" style={{ fontSize: 12, maxWidth: "62ch" }}>
            Already demonstrated: {match.matched.slice(0, 4).join(", ") || describeScope(record.parsed) || "process shape only"}.
          </p>
        </div>

        <div className="stack-2" style={{ minWidth: 132, alignItems: "flex-end" }}>
          <Label>Fit</Label>
          <div className="ticker" style={{ fontSize: 36, fontWeight: 300, lineHeight: 1 }}>
            {match.fitScore}
          </div>
          <div className="match-bar" style={{ width: 132 }}>
            <div className="match-bar-fill" style={{ width: `${match.fitScore}%` }} />
          </div>
        </div>
      </div>

      <div className="cols-4" style={{ gap: 20 }}>
        {(Object.keys(COMPONENT_LABEL) as (keyof MatchResult["components"])[]).map((key, i) => (
          <div key={key} className="stack-2">
            <div className="row-between">
              <span className="label" style={{ fontSize: 9 }}>{COMPONENT_LABEL[key]}</span>
              <span className="mono-sm" style={{ fontSize: 10 }}>
                {Math.round(match.components[key] * 100)}%
              </span>
            </div>
            <div className="conf-bar">
              <div
                className="conf-bar-fill"
                style={{
                  width: `${Math.round(match.components[key] * 100)}%`,
                  transitionDelay: `${index * 90 + i * 70}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="body-text" style={{ maxWidth: "78ch" }}>{match.rationale}</p>

      <div className="split" style={{ gap: 32 }}>
        <div className="stack-3">
          <Label>Relevant competencies</Label>
          {match.matched.length > 0 ? (
            <div className="row-wrap">
              {match.matched.map((m) => (
                <span key={m} className="chip chip-ink">{m}</span>
              ))}
            </div>
          ) : (
            <p className="body-sm" style={{ fontSize: 12 }}>
              Nothing in this record overlaps &ldquo;{query}&rdquo; directly. It ranked on process shape alone.
            </p>
          )}

          <Label>What was tested</Label>
          <div className="row-wrap">
            {record.parsed.competencies.map((c) => (
              <span key={c.name} className="chip" title={DEPTH_LABEL[c.depth]}>
                {c.name}
              </span>
            ))}
          </div>
        </div>

        <div className="stack-3">
          <Label>Known gaps</Label>
          <ul className="stack-2" style={{ listStyle: "none" }}>
            {match.gaps.map((gap) => (
              <li key={gap} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                <span className="prov prov-unknown" style={{ marginTop: 3 }}>?</span>
                <span className="body-sm" style={{ color: "var(--ink)" }}>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="row-between stack-mobile" style={{ gap: 12 }}>
        <div className="row-wrap">
          {record.parsed.rounds.map((round) => (
            <span
              key={round.index}
              className="chip"
              style={round.cleared ? undefined : { opacity: 0.5, borderStyle: "dashed" }}
            >
              {ROUND_LABEL[round.type] ?? round.type}
            </span>
          ))}
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={onOpen}>
          Open evidence · request intro
        </button>
      </div>
    </article>
  );
}
