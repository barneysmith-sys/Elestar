"use client";

/**
 * The interview brief.
 *
 * Structured around provenance rather than around persuasion. Every claim is
 * marked KNOWN (stated in the record), INFERRED (derived by a named rule from
 * something known) or UNKNOWN (absent, and said so). A brief that blurs those
 * three is the failure mode that costs a recruiter a round they shouldn't have
 * skipped, so the distinction is the primary structure of the page rather than
 * a footnote on it.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AnnotatedBrief, BriefFact, Provenance } from "../lib/reasoners/brief";
import type { DossierRecord, IntroRequest } from "../lib/records";
import { DEPTH_LABEL, OUTCOME_LABEL, describeEmployer, describeScope, freshness } from "../lib/records";
import { EngineBadge, Empty, ErrorNote, Label, Mark, ProvenanceChip, SectionHead, TierBadge } from "./primitives";

interface BriefResponse {
  brief: AnnotatedBrief;
  record: DossierRecord;
  intro: IntroRequest;
  meta: { engine: "model" | "deterministic"; engineLabel: string };
}

export function BriefClient({
  recordId,
  introId,
  role,
}: {
  recordId: string | null;
  introId: string | null;
  role: string | null;
}) {
  const [data, setData] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(recordId));
  const [error, setError] = useState<string | null>(null);

  const roleDescription = role ?? "Unspecified role";

  const load = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId,
          introId: introId ?? undefined,
          roleDescription,
          // The hiring team's own loop. Named here so "safe to skip" has real
          // rounds to talk about rather than generic advice.
          hiringLoop: ["Recruiter screen", "Coding interview", "System design", "Team panel", "Final round"],
        }),
      });
      const json = (await res.json()) as BriefResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not generate the brief.");
        return;
      }
      setData(json);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [recordId, introId, roleDescription]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!recordId) {
    return (
      <div className="wrap-narrow section">
        <Empty
          title="A brief needs an approved intro"
          body="Briefs are generated per record, after the candidate approves an intro. Find a record in the Circuit or via search, request an intro, and approve it."
          action={
            <div className="row-wrap">
              <Link href="/search" className="btn-primary btn-sm" style={{ textDecoration: "none" }}>
                Search the pool
              </Link>
              <Link href="/circuit" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
                Browse the Circuit
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wrap-narrow section stack-4">
        <Label>Generating brief for {recordId}…</Label>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card animate-pulse-ink" style={{ height: 120, animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="wrap-narrow section stack-6">
        <ErrorNote>{error}</ErrorNote>
        <p className="body-sm">
          The brief is gated on an approved intro, and the gate is enforced on the server rather than by
          hiding a button. If the intro is still pending, approve it first.
        </p>
        <div className="row-wrap">
          <Link href="/intros" className="btn-primary btn-sm" style={{ textDecoration: "none" }}>
            Open intro requests
          </Link>
          <Link href="/circuit" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            Back to the Circuit
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { brief, record, meta } = data;
  const counts = countProvenance(brief.facts);

  return (
    <div className="wrap-narrow section">
      <SectionHead
        kicker={`Interview brief · ${record.id}`}
        title="What this process already established"
        right={<EngineBadge engine={meta.engine} label={meta.engineLabel} />}
      />

      {/* header strip */}
      <div className="card stack-4" style={{ marginBottom: 40 }}>
        <div className="row-between stack-mobile" style={{ gap: 16 }}>
          <div className="stack-2">
            <Label>Role you are hiring for</Label>
            <div className="body-text" style={{ fontWeight: 400 }}>{roleDescription}</div>
          </div>
          <TierBadge tier={record.tier} />
        </div>
        <hr className="rule" />
        <div className="cols-4" style={{ gap: 20 }}>
          <Stat label="Confidence" value={brief.confidence.toFixed(2)} />
          <Stat label="Known" value={String(counts.known)} />
          <Stat label="Inferred" value={String(counts.inferred)} />
          <Stat label="Unknown" value={String(counts.unknown)} />
        </div>
        <p className="body-sm" style={{ fontSize: 12 }}>{brief.confidenceBasis}</p>
      </div>

      <div className="stack-8">
        <Block n="01" title="Relevant prior intelligence">
          <dl className="stack-3">
            <Row term="Process" value={describeEmployer(record.parsed)} />
            <Row term="Scope" value={describeScope(record.parsed) || "Not stated"} />
            <Row
              term="Depth reached"
              value={`${record.parsed.roundsCleared} of ${record.parsed.roundsTotal ?? record.parsed.rounds.length} rounds cleared`}
            />
            <Row term="Evidence age" value={freshness(record.createdAt)} />
            <Row term="Why it ended" value={OUTCOME_LABEL[record.parsed.outcome]} />
          </dl>
        </Block>

        <Block n="02" title="Competencies already tested" provenance="known">
          {brief.alreadyAssessed.length === 0 ? (
            <p className="body-sm">
              Nothing in this record was assessed at a depth worth carrying over.
            </p>
          ) : (
            <div className="stack-3">
              {brief.alreadyAssessed.map((item) => (
                <div key={`${item.competency}-${item.format}`} className="row-between" style={{ gap: 16 }}>
                  <div className="stack-2">
                    <span className="body-text" style={{ fontWeight: 400 }}>{item.competency}</span>
                    <span className="label">{item.format}</span>
                  </div>
                  <span className={`chip ${item.depth === "assessed" ? "chip-ink" : ""}`}>
                    {DEPTH_LABEL[item.depth]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block n="03" title="Rounds you can probably skip" provenance="inferred">
          {brief.safeToSkip.length === 0 ? (
            <p className="body-sm">
              Nothing is safe to skip. Either no competency was assessed at full depth, or the overlap with
              your loop is too thin to justify it.
            </p>
          ) : (
            <div className="stack-3">
              {brief.safeToSkip.map((item) => (
                <div key={item.round} className="card-flat stack-2" style={{ padding: 16 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="body-text" style={{ fontWeight: 400 }}>{item.round}</span>
                    <ProvenanceChip provenance="inferred" />
                  </div>
                  <span className="body-sm">Redundant with {item.redundantWith}</span>
                </div>
              ))}
              <p className="body-sm" style={{ fontSize: 12 }}>
                Capped at half your loop on purpose. Past that, another company&rsquo;s process stops being
                evidence about yours.
              </p>
            </div>
          )}
        </Block>

        <Block n="04" title="What to probe instead" provenance="inferred">
          <ul className="stack-3" style={{ listStyle: "none" }}>
            {brief.probeInstead.map((item) => (
              <li key={item} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className="dot dot-ink" style={{ marginTop: 8 }} />
                <span className="body-text">{item}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block n="05" title="Never skip these">
          <ul className="stack-3" style={{ listStyle: "none" }}>
            {brief.neverSkip.map((item) => (
              <li key={item} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className="dot dot-stop" style={{ marginTop: 8 }} />
                <span className="body-text">{item}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block n="06" title="Outcome context">
          <p className="body-text">{brief.outcomeContext}</p>
        </Block>

        {/* the ledger */}
        <Block n="07" title="Provenance ledger">
          <p className="body-sm" style={{ marginBottom: 16 }}>
            Every claim above, and where it came from. Nothing in this brief exists without a line here.
          </p>
          <div className="stack-3">
            {(["known", "inferred", "unknown"] as Provenance[]).map((provenance) => {
              const facts = brief.facts.filter((f) => f.provenance === provenance);
              if (facts.length === 0) return null;
              return (
                <div key={provenance} className="stack-3">
                  <div className="row" style={{ gap: 10 }}>
                    <ProvenanceChip provenance={provenance} />
                    <Label>{facts.length} claim{facts.length === 1 ? "" : "s"}</Label>
                  </div>
                  <div className="stack-2">
                    {facts.map((fact, i) => (
                      <div
                        key={`${fact.claim}-${i}`}
                        className="card-flat stack-2"
                        style={{ padding: 14 }}
                      >
                        <span className="body-text" style={{ fontWeight: 400 }}>{fact.claim}</span>
                        <span className="mono-sm" style={{ color: "var(--muted)" }}>{fact.basis}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Block>
      </div>

      <div className="row-wrap no-print" style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
        <button type="button" className="btn-ghost btn-sm" onClick={() => window.print()}>
          Print
        </button>
        <Link href="/circuit" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
          Back to the Circuit
        </Link>
        <div className="row" style={{ gap: 8, marginLeft: "auto" }}>
          <Mark size={13} />
          <Label>Elestar · {record.id}</Label>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Block({
  n,
  title,
  provenance,
  children,
}: {
  n: string;
  title: string;
  provenance?: Provenance;
  children: React.ReactNode;
}) {
  return (
    <section className="stack-4">
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <span className="label" style={{ fontSize: 9 }}>{n}</span>
        <span className="label-ink">{title}</span>
        {provenance && <ProvenanceChip provenance={provenance} />}
      </div>
      <hr className="rule" />
      {children}
    </section>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="row-between" style={{ gap: 16 }}>
      <dt className="label">{term}</dt>
      <dd className="body-text" style={{ textAlign: "right", textTransform: "capitalize" }}>
        {value.replace(/_/g, " ")}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stack-2">
      <Label>{label}</Label>
      <span className="ticker" style={{ fontSize: 26, fontWeight: 300 }}>{value}</span>
    </div>
  );
}

function countProvenance(facts: BriefFact[]): Record<Provenance, number> {
  return {
    known: facts.filter((f) => f.provenance === "known").length,
    inferred: facts.filter((f) => f.provenance === "inferred").length,
    unknown: facts.filter((f) => f.provenance === "unknown").length,
  };
}
