"use client";

import { useEffect, useState } from "react";
import AppNav from "../components/AppNav";
import { PipelineEvidence } from "../components/PipelineEvidence";
import { fetchStatus, type StatusPayload } from "../elestar-api";
import { usePipeline } from "../usePipeline";
import { LAB_SCENARIOS, type LabScenario } from "../../../lib/ingest/scenarios";
import { FIXTURE_CATALOG } from "../../../lib/ingest/fixtureCatalog";
import {
  STEP_EVENT,
  STEP_ORDER,
  STEP_TITLE,
  type AuditStepData,
  type IdentifyStepData,
  type MatchStepData,
  type ResearchStepData,
} from "../../../lib/pipelineWire";

export default function System() {
  const { running, meta, stages, active, questions, done, error, run, cancel } = usePipeline();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [current, setCurrent] = useState<LabScenario>(LAB_SCENARIOS[0]!);

  useEffect(() => {
    void fetchStatus()
      .then(setStatus)
      .catch((err: unknown) => setStatusError(err instanceof Error ? err.message : "Status could not be loaded."));
  }, []);

  const research = stages.research?.message.data as ResearchStepData | undefined;
  const match = stages.match?.message.data as MatchStepData | undefined;
  const audit = stages.audit?.message.data as AuditStepData | undefined;

  return (
    <div style={{ minHeight: "100dvh" }}>
      <AppNav />
      <div className="max-w-[1180px] mx-auto px-5 md:px-7 pt-10 pb-[90px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>System · Agent lab</p>
        <h1 className="font-display font-extralight leading-none mb-4" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", letterSpacing: "-0.045em", color: "var(--navy)" }}>
          Watch the same agent that production uses.
        </h1>
        <p className="text-[16px] leading-relaxed max-w-[54ch] mb-8" style={{ color: "var(--muted-foreground)" }}>
          Every scenario runs the live pipeline over SSE. Fixtures stay labelled simulation. Nothing here is a second, fake implementation.
        </p>

        {statusError && <p className="mb-6">{statusError}</p>}
        {status && (
          <p className="font-mono text-[11px] mb-10" style={{ color: "var(--ink-3)" }}>
            {status.engineLabel} · {status.persistenceLabel} · k={status.kFloor} · pool {status.poolSize}
            {status.inboundWebhook ? " · inbound webhook configured" : " · inbound webhook off"}
            {meta?.pipelineId ? ` · ${meta.pipelineId}` : ""}
          </p>
        )}

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-4" style={{ color: "var(--navy)" }}>Scenarios</p>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {LAB_SCENARIOS.map((scenario) => {
                const on = current.id === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => setCurrent(scenario)}
                    className="w-full text-left py-3.5"
                    style={{ opacity: on ? 1 : 0.55 }}
                  >
                    <p className="font-display text-[18px]" style={{ color: "var(--navy)" }}>{scenario.title}</p>
                    <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>{scenario.intent}</p>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={running}
              onClick={() => void run({ fixture: current.fixture, simulation: true, description: FIXTURE_CATALOG[current.fixture].notes, role: FIXTURE_CATALOG[current.fixture].role })}
              className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 text-[var(--primary-foreground)] disabled:opacity-40"
              style={{ background: "var(--navy)" }}
            >
              {running ? "Running" : "Run this simulation"}
            </button>
            {running && (
              <button type="button" onClick={cancel} className="ml-3 font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 border" style={{ borderColor: "var(--navy)", color: "var(--navy)" }}>
                Cancel
              </button>
            )}
          </div>

          <div className="border p-6 md:p-8" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--background) 70%, var(--card))" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-5" style={{ color: "var(--ink-3)" }}>
              {meta?.simulation ? "Simulated inbound · " : ""}{meta?.engineLabel ?? "Waiting"} · expect {current.expect.replace(/_/g, " ")}
            </p>
            {STEP_ORDER.filter((step) => stages[step] || active === step).map((step) => {
              const stage = stages[step];
              const statusNow = stage?.message.status ?? (active === step ? "running" : undefined);
              const event = stage?.message.event ?? (statusNow === "running" ? STEP_EVENT[step].running : STEP_EVENT[step].settled);
              const duration = stage?.message.durationMs;
              return (
                <div key={step} className="mb-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-[18px]" style={{ color: "var(--navy)" }}>{STEP_TITLE[step]}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-3)" }}>
                      {event}
                      {duration != null ? ` · ${duration}ms` : ""}
                    </p>
                  </div>
                  <p className="font-mono text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                    {stage?.message.message ?? "…"}
                  </p>
                </div>
              );
            })}
            <PipelineEvidence
              identify={stages.identify?.message.data as IdentifyStepData | undefined}
              research={research}
              match={match}
              audit={audit}
            />
            {error && <p className="text-[14px] mt-4">{error}</p>}
            {questions && !done && (
              <p className="text-[14px] mt-4" style={{ color: "var(--muted-foreground)" }}>
                The agent stopped to ask rather than guess. {questions.questions[0]}
              </p>
            )}
            {done && (
              <div className="mt-6">
                <p className="edn-stamp text-[28px]" style={{ color: "var(--navy)" }}>{done.outcome.replace(/_/g, " ")}</p>
                <p className="text-[14px] mt-2" style={{ color: "var(--muted-foreground)" }}>{done.reason}</p>
                {done.recordId && <p className="font-mono text-[12px] mt-3">{done.recordId}</p>}
              </div>
            )}
          </div>
        </div>

        {status && (
          <div className="mt-16 grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Always real</p>
              <ul className="space-y-2">
                {status.alwaysReal.map((item) => (
                  <li key={item} className="text-[15px]">{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Judgement — degrades, and says so</p>
              <ul className="space-y-2">
                {status.degradesToDeterministic.map((item) => (
                  <li key={item} className="text-[15px]">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
