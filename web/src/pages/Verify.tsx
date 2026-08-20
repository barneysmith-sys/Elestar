"use client";

import { useState } from "react";
import AppNav from "../components/AppNav";
import { PROVE_INBOX } from "../elestar-api";
import { usePipeline, OUTCOME_HEADLINE } from "../usePipeline";
import { STEP_ACTIVITY, STEP_ORDER, STEP_TITLE, type IdentifyStepData, type PublishStepData } from "../../../lib/pipelineWire";
import { describeEmployer, furthestRoundLabel } from "../../../lib/records";
import { FIXTURE_CATALOG, FIXTURE_IDS, type FixtureId } from "../../../lib/ingest/fixtureCatalog";

export default function Verify() {
  const { running, meta, stages, active, questions, done, error, run, answer } = usePipeline();
  const [fixture, setFixture] = useState<FixtureId>("canonical");
  const [notes, setNotes] = useState(FIXTURE_CATALOG.canonical.notes);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [hot, setHot] = useState(false);

  const parsed = (stages.identify?.message.data as IdentifyStepData | undefined)?.parsed ?? null;
  const published = (stages.publish?.message.data as PublishStepData | undefined)?.record;

  const startFile = async (file: File) => {
    const forwardedEmails = await file.text();
    void run({ forwardedEmails, description: notes.trim() || "Original recruiter email dropped in the product." });
  };

  return (
    <div style={{ minHeight: "100dvh" }}>
      <AppNav />
      <div className="max-w-[1100px] mx-auto px-5 md:px-7 pt-10 pb-[90px] grid lg:grid-cols-[1.05fr_0.95fr] gap-10">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Verify</p>
          <h1 className="font-display font-extralight leading-none mb-4" style={{ fontSize: "clamp(2.6rem, 6.5vw, 4.8rem)", letterSpacing: "-0.045em", color: "var(--navy)" }}>
            Forward the recruiter email.
          </h1>
          <p className="text-[16px] leading-relaxed max-w-[46ch] mb-8" style={{ color: "var(--muted-foreground)" }}>
            Elestar receives it at the address below, parses interview signals, checks public evidence, runs the privacy audit, and only then decides whether an anonymous record can publish.
          </p>

          <div className="border p-5 mb-6 flex items-center justify-between gap-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-1" style={{ color: "var(--muted-foreground)" }}>Forward to</p>
              <p className="font-mono text-[16px]" style={{ color: "var(--navy)" }}>{PROVE_INBOX}</p>
            </div>
            <button
              type="button"
              className="font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 border"
              style={{ borderColor: "var(--navy)", color: "var(--navy)" }}
              onClick={() => {
                void navigator.clipboard.writeText(PROVE_INBOX);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div
            className="rounded-[13px] p-7 text-center border-[1.5px] border-dashed mb-6"
            style={{
              borderColor: hot ? "var(--accent)" : "var(--border-2)",
              background: hot ? "var(--navy-light)" : "var(--card)",
            }}
            onDragOver={(e) => { e.preventDefault(); setHot(true); }}
            onDragLeave={() => setHot(false)}
            onDrop={(e) => {
              e.preventDefault();
              setHot(false);
              const file = e.dataTransfer.files[0];
              if (file) void startFile(file);
            }}
          >
            <div className="font-display font-normal text-[15px]">Drop an original .eml here</div>
            <p className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>Forward as attachment. A rewrite from your address will not verify.</p>
          </div>

          <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--ink-3)" }}>
              Demo inbox · this deployment cannot receive live mail
            </p>
            <p className="text-[14px] mb-4" style={{ color: "var(--muted-foreground)" }}>
              Simulate an inbound fixture. The pipeline that then runs is the real one.
            </p>
            <select
              value={fixture}
              onChange={(e) => {
                const id = e.target.value as FixtureId;
                setFixture(id);
                setNotes(FIXTURE_CATALOG[id].notes);
              }}
              className="w-full border px-3 py-2 text-[13px] bg-transparent mb-3"
              style={{ borderColor: "var(--border-2)", color: "var(--foreground)" }}
            >
              {FIXTURE_IDS.map((id) => (
                <option key={id} value={id}>{FIXTURE_CATALOG[id].label} — {FIXTURE_CATALOG[id].note}</option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none mb-4"
              style={{ color: "var(--foreground)" }}
            />
            <button
              type="button"
              disabled={running}
              onClick={() => void run({ fixture, simulation: true, description: notes.trim() || FIXTURE_CATALOG[fixture].notes, role: FIXTURE_CATALOG[fixture].role })}
              className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 text-[var(--primary-foreground)] disabled:opacity-40"
              style={{ background: "var(--navy)" }}
            >
              {running ? "Running pipeline" : "Simulate inbound"}
            </button>
          </div>
        </div>

        <div className="border p-6 md:p-8 min-h-[420px]" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--background) 70%, var(--card))" }}>
          {meta && (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-5" style={{ color: "var(--ink-3)" }}>
              {meta.simulation ? "Simulated inbound · " : ""}{meta.engineLabel} · {meta.persistenceLabel}
            </p>
          )}
          {STEP_ORDER.filter((step) => stages[step] || active === step).map((step) => {
            const stage = stages[step];
            return (
              <div key={step} className="mb-4">
                <p className="font-display text-[18px]" style={{ color: "var(--navy)" }}>{STEP_TITLE[step]}</p>
                <p className="font-mono text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                  {stage?.message.message ?? STEP_ACTIVITY[step]}
                </p>
              </div>
            );
          })}
          {error && <p className="text-[14px] mt-4">{error}</p>}
          {questions && !done && (
            <div className="mt-6 space-y-3">
              {questions.questions.map((q) => (
                <label key={q} className="block">
                  <span className="block text-[14px] mb-1.5">{q}</span>
                  <input
                    value={answers[q] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                    className="w-full border px-3 py-2 text-[14px] outline-none"
                    style={{ borderColor: "var(--border-2)", background: "var(--card)" }}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() => void answer(answers)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 text-white"
                style={{ background: "var(--navy)" }}
              >
                Continue
              </button>
            </div>
          )}
          {done && (
            <div className="mt-6">
              <p className="edn-stamp text-[28px]" style={{ color: "var(--navy)" }}>{OUTCOME_HEADLINE[done.outcome]}</p>
              <p className="text-[14px] mt-2" style={{ color: "var(--muted-foreground)" }}>{done.reason}</p>
              {published && (
                <p className="font-mono text-[12px] mt-3">
                  {published.id} · {describeEmployer(published.parsed)} · {furthestRoundLabel(published.parsed)}
                </p>
              )}
              {parsed && !published && (
                <p className="font-mono text-[12px] mt-3">{describeEmployer(parsed)} · {furthestRoundLabel(parsed)}</p>
              )}
            </div>
          )}
          {!meta && !running && (
            <p className="font-display text-[22px] leading-tight" style={{ color: "var(--navy)" }}>
              Waiting for inbound.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
