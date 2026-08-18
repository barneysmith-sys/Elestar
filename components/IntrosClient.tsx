"use client";

/**
 * The intro inbox — both sides of the gate in one place.
 *
 * This is the whole state machine made visible: which records have been asked
 * about, what is waiting on a candidate, what was approved, and what was
 * declined. It exists because the intro gate is the single most important
 * claim the product makes, and a claim like that should be inspectable rather
 * than buried in a slide-over.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DossierRecord, IntroRequest, IntroStatus } from "../lib/records";
import { describeEmployer, freshness } from "../lib/records";
import { Empty, EngineBadge, ErrorNote, Label, SectionHead, TierBadge } from "./primitives";

const STATUS_ORDER: IntroStatus[] = ["pending", "approved", "declined"];

const STATUS_COPY: Record<IntroStatus, { title: string; body: string; chip: string }> = {
  pending: {
    title: "Waiting on the candidate",
    body: "Nothing has been released. A pending request contains no identity — in Postgres a CHECK constraint makes that impossible, not just unlikely.",
    chip: "chip-warn",
  },
  approved: {
    title: "Approved",
    body: "The candidate released contact details, and only then. A brief is available for these.",
    chip: "chip-ok",
  },
  declined: {
    title: "Declined",
    body: "No identity was released and no brief exists. The record stays in the pool, anonymous.",
    chip: "chip-stop",
  },
};

/** See CircuitClient: the engine label is server-known so it lands in first paint. */
export function IntrosClient({
  initialEngine,
  initialEngineLabel,
}: {
  initialEngine: "model" | "deterministic";
  initialEngineLabel: string;
}) {
  const [intros, setIntros] = useState<IntroRequest[]>([]);
  const [records, setRecords] = useState<Map<string, DossierRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [introRes, circuitRes] = await Promise.all([
        fetch("/api/intro", { cache: "no-store" }),
        fetch("/api/circuit", { cache: "no-store" }),
      ]);

      if (!introRes.ok) {
        setError("Could not load intro requests.");
        return;
      }
      const introBody = (await introRes.json()) as { intros: IntroRequest[] };
      setIntros(introBody.intros ?? []);

      if (circuitRes.ok) {
        const body = (await circuitRes.json()) as { records: DossierRecord[] };
        setRecords(new Map((body.records ?? []).map((r) => [r.id, r])));
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

  const decide = useCallback(async (introId: string, decision: "approved" | "declined") => {
    setBusy(introId);
    setError(null);
    try {
      const res = await fetch("/api/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide", introId, decision }),
      });
      const json = (await res.json()) as { intro?: IntroRequest; error?: string };
      if (!res.ok || !json.intro) {
        setError(json.error ?? "That didn't work. Nothing changed.");
        return;
      }
      setIntros((prev) => prev.map((i) => (i.id === json.intro!.id ? json.intro! : i)));
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div className="wrap section">
      <SectionHead
        kicker="Intros"
        title="The only path to an identity"
        sub="A record can be searched, matched and read without anyone knowing whose it is. Contact details exist on exactly one condition: the candidate approved this specific request."
        right={<EngineBadge engine={initialEngine} label={initialEngineLabel} />}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading && (
        <div className="stack-4">
          {[0, 1].map((i) => (
            <div key={i} className="card animate-pulse-ink" style={{ height: 128, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      )}

      {!loading && intros.length === 0 && (
        <Empty
          title="No intro requests yet"
          body="Search the pool or browse the Circuit, open a record, and request an intro. The request lands here for the candidate to approve or decline."
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
      )}

      {!loading && intros.length > 0 && (
        <div className="stack-8">
          {STATUS_ORDER.map((status) => {
            const group = intros.filter((i) => i.status === status);
            if (group.length === 0) return null;
            const copy = STATUS_COPY[status];

            return (
              <section key={status} className="stack-4">
                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                  <span className={`chip ${copy.chip}`}>{status}</span>
                  <span className="label-ink">{copy.title}</span>
                  <Label>
                    {group.length} request{group.length === 1 ? "" : "s"}
                  </Label>
                </div>
                <p className="body-sm" style={{ maxWidth: "74ch" }}>{copy.body}</p>

                <div className="stack-3">
                  {group.map((intro) => {
                    const record = records.get(intro.dossierId);
                    return (
                      <article key={intro.id} className="card stack-4">
                        <div className="row-between stack-mobile" style={{ gap: 16, alignItems: "flex-start" }}>
                          <div className="stack-2" style={{ minWidth: 0 }}>
                            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                              <span className="mono-sm" style={{ fontWeight: 500 }}>{intro.dossierId}</span>
                              {record && <TierBadge tier={record.tier} />}
                            </div>
                            {record && (
                              <div className="body-text" style={{ textTransform: "capitalize" }}>
                                {describeEmployer(record.parsed)}
                              </div>
                            )}
                            {intro.roleDescription && (
                              <div className="label">Requested for: {intro.roleDescription}</div>
                            )}
                            <div className="label">Requested {freshness(intro.requestedAt)}</div>
                          </div>

                          {intro.status === "pending" && (
                            <div className="row-wrap">
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                disabled={busy === intro.id}
                                onClick={() => void decide(intro.id, "approved")}
                              >
                                {busy === intro.id ? "Working…" : "Approve"}
                              </button>
                              <button
                                type="button"
                                className="btn-ghost btn-sm"
                                disabled={busy === intro.id}
                                onClick={() => void decide(intro.id, "declined")}
                              >
                                Decline
                              </button>
                            </div>
                          )}

                          {intro.status === "approved" && (
                            <Link
                              href={`/brief?recordId=${encodeURIComponent(intro.dossierId)}&introId=${encodeURIComponent(intro.id)}&role=${encodeURIComponent(intro.roleDescription || "Unspecified role")}`}
                              className="btn-primary btn-sm"
                              style={{ textDecoration: "none" }}
                            >
                              Open brief
                            </Link>
                          )}
                        </div>

                        <div className="stack-2">
                          <Label>Identity released</Label>
                          {intro.revealedIdentity ? (
                            <div className="stack-2">
                              <span className="body-text" style={{ fontWeight: 400 }}>
                                {intro.revealedIdentity.alias} · {intro.revealedIdentity.channel}
                              </span>
                              <span className="mono-sm" style={{ color: "var(--muted)" }}>
                                {intro.revealedIdentity.note}
                              </span>
                            </div>
                          ) : (
                            <span className="mono-sm" style={{ color: "var(--muted)" }}>
                              null — nothing has been released for this request.
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
