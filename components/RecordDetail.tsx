"use client";

/**
 * The evidence view for one record, plus the intro state machine.
 *
 * The panel answers five questions in order, because they are the questions
 * that make the record worth anything: what was tested, what happened, what
 * evidence exists, how confident Elestar is, and what is still unknown. The
 * last one is not padding — a record that only lists strengths is a sales
 * pitch, and the brief downstream depends on the gaps being explicit.
 *
 * Identity stays protected here regardless of what the user clicks. Requesting
 * an intro creates a pending row; only the candidate's approval can move it,
 * and the panel reflects whatever the server says rather than assuming success.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DossierRecord, IntroRequest } from "../lib/records";
import {
  DEPTH_LABEL,
  EVIDENCE_LABEL,
  OUTCOME_LABEL,
  ROUND_LABEL,
  TIER_MEANING,
  describeEmployer,
  describeScope,
  freshness,
  monthsSince,
} from "../lib/records";
import { Label, Mark, TierBadge } from "./primitives";

const INTRO_STEPS = ["Requested", "Pending", "Approved", "Brief"] as const;

export function RecordDetail({
  record,
  intro,
  roleDescription,
  onClose,
  onIntroChange,
}: {
  record: DossierRecord;
  intro: IntroRequest | null;
  roleDescription: string;
  onClose: () => void;
  onIntroChange: (intro: IntroRequest) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "request" | "approve" | "decline">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const post = useCallback(
    async (body: Record<string, unknown>, phase: "request" | "approve" | "decline") => {
      setBusy(phase);
      setError(null);
      try {
        const res = await fetch("/api/intro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { intro?: IntroRequest; error?: string };
        if (!res.ok || !json.intro) {
          setError(json.error ?? "That didn't work. Nothing changed.");
          return;
        }
        onIntroChange(json.intro);
      } catch {
        setError("Couldn't reach the server. Nothing changed.");
      } finally {
        setBusy(null);
      }
    },
    [onIntroChange],
  );

  const stage = introStage(intro);
  const { parsed } = record;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "flex-end" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Record ${record.id}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(27,30,45,0.24)",
          border: "none",
          cursor: "pointer",
          backdropFilter: "blur(2px)",
        }}
      />

      <div
        className="panel-scroll animate-slide-right"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 580,
          height: "100%",
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        {/* sticky header */}
        <div
          className="row-between"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            padding: "20px 28px",
            background: "rgba(234,230,220,0.95)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="row" style={{ gap: 10 }}>
            <Mark size={14} />
            <span className="mono-sm" style={{ fontWeight: 500 }}>{record.id}</span>
            <TierBadge tier={record.tier} />
          </div>
          <button type="button" className="link-quiet" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="stack-8" style={{ padding: "28px 28px 64px" }}>
          {/* summary */}
          <section className="stack-3">
            <Label>Record</Label>
            <h2 className="display-md" style={{ textTransform: "capitalize" }}>{describeEmployer(parsed)}</h2>
            <div className="body-sm">{describeScope(parsed) || "Scope not stated"}</div>
            <div className="row-wrap">
              <span className="chip">{TIER_MEANING[record.tier]}</span>
              <span className={`chip ${record.evidence === "corroborated" ? "chip-ok" : ""}`}>
                {EVIDENCE_LABEL[record.evidence]}
              </span>
              <span className="chip">{freshness(record.createdAt)}</span>
              {record.demo && <span className="chip">Demo data</span>}
            </div>
            {parsed.evidence === "corroborated" && (
              <p className="body-sm" style={{ fontSize: 12 }}>
                The submitted loop was corroborated against public recruiting evidence. The recruiter
                mailbox is not part of this record.
              </p>
            )}
          </section>

          <hr className="rule" />

          {/* 1. what was tested */}
          <Section n="01" title="What was tested">
            <div className="stack-3">
              {parsed.rounds.map((round) => {
                const tested = parsed.competencies.filter((c) => c.roundIndex === round.index);
                return (
                  <div key={round.index} className="card stack-2">
                    <div className="row-between">
                      <div className="row" style={{ gap: 10 }}>
                        <span className="label" style={{ fontSize: 9 }}>
                          {String(round.index).padStart(2, "0")}
                        </span>
                        <span className="body-text" style={{ fontWeight: 400 }}>{round.label}</span>
                      </div>
                      <span className={`chip ${round.cleared ? "chip-ok" : ""}`}>
                        {round.cleared ? "Cleared" : "Not cleared"}
                      </span>
                    </div>
                    <div className="row-wrap">
                      <span className="chip">{ROUND_LABEL[round.type] ?? round.type}</span>
                      {tested.map((c) => (
                        <span key={c.name} className="chip">
                          {c.name} · {DEPTH_LABEL[c.depth]}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 2. what happened */}
          <Section n="02" title="What happened">
            <dl className="stack-3">
              <DRow
                term="Depth reached"
                value={`${parsed.roundsCleared} of ${parsed.roundsTotal ?? parsed.rounds.length} rounds cleared`}
              />
              <DRow term="Loop length" value={parsed.loopLengthWeeks ? `${parsed.loopLengthWeeks} weeks` : "Not stated"} />
              <DRow term="Why it ended" value={OUTCOME_LABEL[parsed.outcome]} />
              <DRow term="Process type" value={parsed.processType} />
            </dl>
            {parsed.outcome === "unstated" && (
              <p className="body-sm" style={{ fontSize: 12, marginTop: 12 }}>
                The candidate didn&rsquo;t state why the process ended, so nothing is recorded. Elestar never
                reads a rejection as a performance outcome.
              </p>
            )}
          </Section>

          {/* 3. what evidence exists */}
          <Section n="03" title="What evidence exists">
            <div className="stack-3">
              {parsed.competencies.map((c) => (
                <div key={c.name} className="row-between" style={{ gap: 16 }}>
                  <span className="body-text">{c.name}</span>
                  <span className={`chip ${c.depth === "assessed" ? "chip-ink" : c.depth === "probed" ? "" : "chip-warn"}`}>
                    {DEPTH_LABEL[c.depth]}
                  </span>
                </div>
              ))}
            </div>
            <p className="body-sm" style={{ fontSize: 12, marginTop: 14 }}>
              Assessed means a whole round went to it. Probed means part of one. Mentioned means it came up in
              conversation and is not evidence of anything.
            </p>
          </Section>

          {/* 4. confidence */}
          <Section n="04" title="How confident Elestar is">
            <div className="stack-4">
              <div className="stack-2">
                <div className="row-between">
                  <span className="label">Round-count confidence</span>
                  <span className="mono-sm">{parsed.roundsConfidence.toFixed(2)}</span>
                </div>
                <div className="conf-bar">
                  <div className="conf-bar-fill" style={{ width: `${Math.round(parsed.roundsConfidence * 100)}%` }} />
                </div>
              </div>

              {record.audit && (
                <div className="cols-3" style={{ gap: 16 }}>
                  <MiniStat label="Risk" value={`${record.audit.riskScore}/100`} />
                  <MiniStat label="Cohort k" value={String(record.audit.kAnonymity)} />
                  <MiniStat label="Recency" value={`${monthsSince(record.createdAt)}mo`} />
                </div>
              )}
            </div>
          </Section>

          {/* 5. what is still unknown */}
          <Section n="05" title="What is still unknown">
            <ul className="stack-2" style={{ listStyle: "none" }}>
              {unknowns(record).map((line) => (
                <li key={line} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                  <span className="prov prov-unknown" style={{ marginTop: 3 }}>?</span>
                  <span className="body-text">{line}</span>
                </li>
              ))}
            </ul>
          </Section>

          <hr className="rule" />

          {/* intro state machine */}
          <Section n="06" title="Intro">
            <div className="stack-4">
              <div className="row" style={{ gap: 0 }}>
                {INTRO_STEPS.map((step, i) => {
                  const reached = i <= stage;
                  return (
                    <div key={step} className="row" style={{ gap: 0, flex: 1 }}>
                      <div className="stack-2" style={{ alignItems: "center", minWidth: 0 }}>
                        <span className={`dot ${reached ? "dot-ink" : ""}`} />
                        <span className="label" style={{ fontSize: 8.5, textAlign: "center" }}>{step}</span>
                      </div>
                      {i < INTRO_STEPS.length - 1 && (
                        <div
                          style={{
                            flex: 1,
                            height: 1,
                            marginTop: 3,
                            background: i < stage ? "var(--ink)" : "var(--border)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {!intro && (
                <div className="stack-3">
                  <p className="body-sm">
                    Requesting an intro creates a pending request. It reveals nothing on its own — only the
                    candidate can release contact details, and until they do there is no row that could
                    contain them.
                  </p>
                  <button
                    type="button"
                    className="btn-primary intro-btn-idle btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    disabled={busy !== null}
                    onClick={() =>
                      void post(
                        { action: "request", recordId: record.id, roleDescription: roleDescription || "Unspecified role" },
                        "request",
                      )
                    }
                  >
                    {busy === "request" ? "Requesting…" : "Request intro"}
                  </button>
                </div>
              )}

              {intro?.status === "pending" && (
                <div className="stack-3">
                  <span className="chip chip-warn" style={{ alignSelf: "flex-start" }}>
                    Pending the candidate&rsquo;s decision
                  </span>
                  <p className="body-sm">
                    In a live deployment this waits for the candidate. This deployment lets you act as both
                    sides so the whole flow can be run end to end — the gate itself is real and enforced on
                    the server.
                  </p>
                  <div className="row-wrap">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={busy !== null}
                      onClick={() => void post({ action: "decide", introId: intro.id, decision: "approved" }, "approve")}
                    >
                      {busy === "approve" ? "Approving…" : "Approve as candidate"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={busy !== null}
                      onClick={() => void post({ action: "decide", introId: intro.id, decision: "declined" }, "decline")}
                    >
                      {busy === "decline" ? "Declining…" : "Decline"}
                    </button>
                  </div>
                </div>
              )}

              {intro?.status === "approved" && (
                <div className="stack-3">
                  <span className="chip chip-ok" style={{ alignSelf: "flex-start" }}>Approved</span>
                  {intro.revealedIdentity && (
                    <div className="card stack-2">
                      <Label>{intro.revealedIdentity.channel}</Label>
                      <div className="body-text" style={{ fontWeight: 400 }}>{intro.revealedIdentity.alias}</div>
                      <p className="body-sm" style={{ fontSize: 12 }}>{intro.revealedIdentity.note}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn-primary intro-btn-approved btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() =>
                      router.push(
                        `/brief?recordId=${encodeURIComponent(record.id)}&introId=${encodeURIComponent(intro.id)}` +
                          `&role=${encodeURIComponent(roleDescription || "Unspecified role")}`,
                      )
                    }
                  >
                    Generate interview brief
                  </button>
                </div>
              )}

              {intro?.status === "declined" && (
                <div className="stack-3">
                  <span className="chip chip-stop" style={{ alignSelf: "flex-start" }}>Declined</span>
                  <p className="body-sm">
                    The candidate declined. No identity was released and no brief is available for this
                    record.
                  </p>
                </div>
              )}

              {error && (
                <p className="body-sm" style={{ color: "var(--stop)" }}>{error}</p>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="stack-4">
      <div className="row" style={{ gap: 12 }}>
        <span className="label" style={{ fontSize: 9 }}>{n}</span>
        <span className="label-ink">{title}</span>
      </div>
      {children}
    </section>
  );
}

function DRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="row-between" style={{ gap: 16 }}>
      <dt className="label">{term}</dt>
      <dd className="body-text" style={{ textAlign: "right", textTransform: "capitalize" }}>
        {value.replace(/_/g, " ")}
      </dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stack-2">
      <Label>{label}</Label>
      <span className="ticker" style={{ fontSize: 20 }}>{value}</span>
    </div>
  );
}

function introStage(intro: IntroRequest | null): number {
  if (!intro) return -1;
  if (intro.status === "pending") return 1;
  if (intro.status === "approved") return 3;
  return 0;
}

/**
 * What this record genuinely cannot tell you. Derived from the record rather
 * than written as copy, so it stays true as the data changes.
 */
function unknowns(record: DossierRecord): string[] {
  const { parsed } = record;
  const out: string[] = [];

  if (parsed.outcome === "unstated") {
    out.push("Why the process ended. The candidate didn't say, and it is not inferred.");
  }
  const mentioned = parsed.competencies.filter((c) => c.depth === "mentioned");
  if (mentioned.length > 0) {
    out.push(`${mentioned.map((c) => c.name).join(", ")} — raised but never assessed.`);
  }
  if (record.evidence === "self_attested") {
    out.push("Third-party corroboration of the loop. This record is self-attested.");
  }
  if (parsed.roundsTotal !== null && parsed.rounds.length < parsed.roundsTotal) {
    out.push(
      `${parsed.roundsTotal - parsed.rounds.length} round(s) are counted but unlabelled — no labels were invented for them.`,
    );
  }
  if (!parsed.employerProfile.sizeBand) {
    out.push("Employer headcount. Withheld or never stated.");
  }
  if (parsed.roundsConfidence < 0.85) {
    out.push(`Exact round count is uncertain (confidence ${parsed.roundsConfidence.toFixed(2)}).`);
  }
  out.push("Anything specific to your codebase, team or domain. This is process signal, not fit.");

  return out;
}
