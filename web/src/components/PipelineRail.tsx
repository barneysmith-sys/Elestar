"use client";

import { HERO_RAIL, outcomeStamp, productCaption, type OutcomeStamp } from "../../../lib/pipelineCaptions";
import { STEP_EVENT, STEP_ORDER, STEP_TITLE, type AuditStepData, type MatchStepData, type PipelineStep, type ResearchStepData } from "../../../lib/pipelineWire";
import type { DoneMessage, StepMessage } from "../../../lib/pipelineWire";

type StageMap = Partial<Record<PipelineStep, { message: StepMessage }>>;

export function PipelineRail({
  stages,
  active,
  done,
  questions,
  error,
  compact = false,
}: {
  stages: StageMap;
  active: PipelineStep | null;
  done?: DoneMessage;
  questions?: boolean;
  error?: string | null;
  compact?: boolean;
}) {
  const research = stages.research?.message.data as ResearchStepData | undefined;
  const match = stages.match?.message.data as MatchStepData | undefined;
  const audit = stages.audit?.message.data as AuditStepData | undefined;
  const stamp = done || questions || error
    ? outcomeStamp({ done, questions, error, match, research, audit })
    : null;

  const steps = compact ? HERO_RAIL.map((row) => row.step) : STEP_ORDER;

  return (
    <div>
      <ol className="relative">
        {steps.map((step, i) => {
          const stage = stages[step];
          const running = active === step;
          const settled = Boolean(stage);
          const event = stage?.message.event ?? (running ? STEP_EVENT[step].running : undefined);
          const caption = productCaption(step, stage?.message);
          const label = compact ? (HERO_RAIL.find((row) => row.step === step)?.label ?? STEP_TITLE[step]) : STEP_TITLE[step];
          return (
            <li key={step} className="relative pl-6 pb-6 last:pb-0">
              {i < steps.length - 1 && (
                <span
                  className="absolute left-[5px] top-4 bottom-0 w-px"
                  style={{ background: settled || running ? "var(--navy)" : "var(--border)" }}
                />
              )}
              <span
                className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full"
                style={{
                  background: running ? "var(--accent)" : settled ? "var(--navy)" : "transparent",
                  border: "1.5px solid var(--navy)",
                  opacity: settled || running ? 1 : 0.35,
                }}
              />
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className="font-display leading-none"
                  style={{
                    fontSize: compact ? "1.35rem" : "1.15rem",
                    color: "var(--navy)",
                    opacity: settled || running ? 1 : 0.4,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {label}
                </p>
                {event && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-3)" }}>
                    {event.replace(/_/g, " ")}
                    {stage?.message.durationMs != null ? ` · ${stage.message.durationMs}ms` : ""}
                  </p>
                )}
              </div>
              <p className="font-mono text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {caption || (running ? "…" : "Waiting")}
              </p>
            </li>
          );
        })}
      </ol>
      {stamp && <OutcomeMark stamp={stamp.stamp} detail={stamp.detail} />}
    </div>
  );
}

export function OutcomeMark({ stamp, detail }: { stamp: OutcomeStamp; detail: string }) {
  const verified = stamp === "VERIFIED";
  return (
    <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
      <p
        className="edn-stamp leading-none"
        style={{
          fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
          color: verified ? "var(--verify)" : "var(--navy)",
          letterSpacing: "-0.04em",
        }}
      >
        {stamp}
      </p>
      <p className="text-[14px] mt-3 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{detail}</p>
    </div>
  );
}
