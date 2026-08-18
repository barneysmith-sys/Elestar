"use client";

/**
 * The listing flow, as a visible pipeline.
 *
 * Every stage panel here renders a payload that the server actually sent:
 * the redaction sweep highlights the character ranges `redact()` matched, the
 * round cards are the rounds the parser emitted, the tier ticker lands on the
 * tier `computeTier()` returned, and the cohort counter shows the measured k
 * the audit was given. Nothing animates a number the product didn't produce.
 *
 * The one piece of stagecraft is pacing: messages are queued and applied with
 * a minimum dwell per stage, because the deterministic path completes in
 * single-digit milliseconds and a pipeline that finishes before it renders
 * teaches the viewer nothing. The transitions are real; only their spacing is
 * chosen.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ParsedProcess } from "../src/types";
import {
  OUTCOME_HEADLINE,
  STEP_ACTIVITY,
  STEP_ORDER,
  STEP_TITLE,
  type AuditStepData,
  type DoneMessage,
  type IngestStepData,
  type MetaMessage,
  type ParseStepData,
  type PipelineMessage,
  type PipelineStep,
  type PublishStepData,
  type RedactStepData,
  type StepMessage,
  type TierStepData,
  type VerifyStepData,
} from "../lib/pipelineWire";
import {
  DEPTH_LABEL,
  OUTCOME_LABEL,
  ROUND_LABEL,
  describeEmployer,
  describeScope,
} from "../lib/records";
import { EngineBadge, ErrorNote, Label, Mark, TierBadge } from "./primitives";
import {
  CANONICAL_FORWARDS,
  CRYPTO_FORWARDS,
  GMAIL_FORWARDS,
  HEALTHTECH_FORWARDS,
  MISMATCH_FORWARDS,
} from "../lib/verify/mailFixtures";

/** Minimum time a stage stays on screen, so each one is legible. */
const DWELL_MS: Record<PipelineStep, number> = {
  ingest: 1600,
  redact: 1500,
  parse: 2100,
  tier: 1300,
  verify: 2200,
  audit: 1900,
  publish: 1200,
};

export const EXAMPLES: {
  label: string;
  note: string;
  role: string;
  forwards: string;
  notes: string;
}[] = [
  {
    label: "Full loop, rejected at the final",
    note: "Publishes. Four forwarded messages, three rounds cleared, outcome never stated.",
    role: "Senior Backend Engineer",
    forwards: CANONICAL_FORWARDS,
    notes: "Senior Backend Engineer at a Series B fintech.",
  },
  {
    label: "Ambiguous round count",
    note: "Stops and asks. The parser will not guess a round count.",
    role: "Backend Engineer",
    forwards: HEALTHTECH_FORWARDS,
    notes: "Series A healthtech company, maybe 40 people. Never heard back.",
  },
  {
    label: "Too identifiable to publish",
    note: "Blocked by the privacy audit. Small company, long specific loop.",
    role: "Head of Engineering",
    forwards: CRYPTO_FORWARDS,
    notes: "Head of Engineering at a 12-person seed-stage crypto custody startup in Dublin.",
  },
  {
    label: "Contains contact details",
    note: "Shows redaction removing real identifiers before anything leaves.",
    role: "Senior Backend Engineer",
    forwards: CANONICAL_FORWARDS,
    notes:
      "Reach me at ada@example.com or +1 (415) 555-0199 — portfolio at https://ada.example.com, handle @adalovelace.\nSenior Backend Engineer at a Series B fintech.",
  },
  {
    label: "Company mismatch",
    note: "Verification fails. Fintech loop against a healthcare recruiter domain.",
    role: "Senior Backend Engineer",
    forwards: MISMATCH_FORWARDS,
    notes: "Senior Backend Engineer at a Series B fintech.",
  },
  {
    label: "Personal email",
    note: "Verification fails. A gmail address is not a company signal.",
    role: "Senior Backend Engineer",
    forwards: GMAIL_FORWARDS,
    notes: "Senior Backend Engineer at a Series B fintech.",
  },
];

interface StageState {
  message: StepMessage;
}

export function PipelineRunner({ initialText }: { initialText?: string }) {
  const [forwards, setForwards] = useState(EXAMPLES[0]!.forwards);
  const [notes, setNotes] = useState(initialText ?? EXAMPLES[0]!.notes);
  const [role, setRole] = useState(EXAMPLES[0]!.role);
  const [submittedText, setSubmittedText] = useState("");
  const [intakeLocked, setIntakeLocked] = useState(false);
  const [running, setRunning] = useState(false);
  const [meta, setMeta] = useState<MetaMessage | null>(null);
  const [stages, setStages] = useState<Partial<Record<PipelineStep, StageState>>>({});
  const [active, setActive] = useState<PipelineStep | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState<DoneMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pacing machinery. The queue holds messages as they arrive; the drain loop
  // applies them one at a time with a dwell so each stage is readable.
  const queue = useRef<PipelineMessage[]>([]);
  const draining = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  const apply = useCallback((message: PipelineMessage) => {
    switch (message.kind) {
      case "meta":
        setMeta(message);
        break;
      case "step":
        setStages((prev) => ({ ...prev, [message.step]: { message } }));
        setActive(message.step);
        break;
      case "questions":
        setQuestions(message.questions);
        setAnswers({});
        break;
      case "done":
        setDone(message);
        break;
    }
  }, []);

  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;

    while (queue.current.length > 0) {
      if (cancelled.current) break;
      const message = queue.current.shift()!;
      apply(message);

      if (message.kind === "step" && message.status === "running") {
        // Hold on the "running" frame so the activity line is readable, but
        // never longer than the stage's own dwell.
        await sleep(Math.min(DWELL_MS[message.step], 900));
      } else if (message.kind === "step") {
        await sleep(DWELL_MS[message.step]);
      } else {
        await sleep(320);
      }
    }

    draining.current = false;
  }, [apply]);

  const run = useCallback(
    async (priorAnswers?: Record<string, string>) => {
      const description = notes.trim();
      const forwardedEmails = forwards.trim();
      if (!description && !forwardedEmails) return;

      setRunning(true);
      setIntakeLocked(true);
      setSubmittedText([description, forwardedEmails].filter(Boolean).join("\n\n"));
      setStages({});
      setActive(null);
      setQuestions(null);
      setDone(null);
      setError(null);
      queue.current = [];

      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            forwardedEmails: forwardedEmails || undefined,
            priorAnswers,
            role: role.trim() || undefined,
          }),
        });

        if (!res.ok || !res.body) {
            setError(
              res.status === 400
                ? "That submission wasn't accepted. Try describing the loop in a sentence or two."
                : "The pipeline couldn't start. Nothing was published.",
            );
            setRunning(false);
            setIntakeLocked(false);
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              queue.current.push(JSON.parse(line.slice(6)) as PipelineMessage);
            } catch {
              // A malformed frame is not worth tearing down a run over.
            }
          }
          void drain();
        }

        // Wait for the paced queue to finish before releasing the button.
        while (queue.current.length > 0 || draining.current) {
          if (cancelled.current) break;
          await sleep(120);
        }
      } catch {
        setError("Lost connection while processing. Nothing was published — you can try again.");
      } finally {
        if (!cancelled.current) setRunning(false);
      }
    },
    [drain, notes, forwards, role],
  );

  const parsed = (stages.parse?.message.data as ParseStepData | undefined)?.parsed ?? null;
  const canAnswer = questions !== null && questions.every((q) => (answers[q] ?? "").trim().length > 0);

  return (
    <div className="stack-8">
      {/* ---- intake ------------------------------------------------------ */}
      <section className="stack-4">
        <div className="row-between">
          <Label>Forwarded recruiter emails</Label>
          {meta && <EngineBadge engine={meta.engine} label={meta.engineLabel} />}
        </div>

        <textarea
          className="field"
          style={{ minHeight: 220 }}
          value={forwards}
          onChange={(e) => setForwards(e.target.value)}
          disabled={running}
          maxLength={24000}
          aria-label="Forwarded recruiter emails"
          placeholder="From: recruiter@company.example&#10;Subject: Recruiter screen&#10;&#10;Paste the emails they sent you. Elestar reads them to see how far you got."
        />

        <div className="split" style={{ gap: 16 }}>
          <label className="stack-2">
            <Label>Notes (optional)</Label>
            <textarea
              className="field"
              style={{ minHeight: 84 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={running}
              maxLength={8000}
              aria-label="Notes about the process"
              placeholder="Senior Backend Engineer at a Series B fintech."
            />
          </label>
          <label className="stack-2">
            <Label>Role (optional)</Label>
            <input
              type="text"
              className="field"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={running}
              maxLength={200}
              aria-label="Role"
              placeholder="Senior Backend Engineer"
            />
            {intakeLocked && (
              <span className="mono-sm" style={{ color: "var(--muted)" }}>
                {(() => {
                  const data = stages.verify?.message.data as VerifyStepData | undefined;
                  if (data?.maskedSignal && data.domain) return `From: ${data.maskedSignal} → ${data.domain}`;
                  if (data?.domain) return data.domain;
                  return "Mailbox stays on this side of the owner boundary.";
                })()}
              </span>
            )}
          </label>
        </div>

        <div className="row-between stack-mobile" style={{ gap: 12 }}>
          <div className="row-wrap">
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                className="chip hoverable"
                style={{ cursor: running ? "not-allowed" : "pointer" }}
                disabled={running}
                title={example.note}
                onClick={() => {
                  setForwards(example.forwards);
                  setNotes(example.notes);
                  setRole(example.role);
                  setIntakeLocked(false);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={running || (!notes.trim() && !forwards.trim())}
            onClick={() => void run()}
          >
            {running ? "Running pipeline…" : "Run pipeline"}
          </button>
        </div>

        <p className="body-sm" style={{ fontSize: 12 }}>
          Forward the emails the recruiter sent you. Elestar reads From, Subject and body to see
          how far the loop got. The mailbox is a verification credential, not public identity —
          nothing publishes unless verification and the privacy audit both clear.
        </p>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* ---- stage rail -------------------------------------------------- */}
      {(running || Object.keys(stages).length > 0) && (
        <StageRail stages={stages} active={active} />
      )}

      {/* ---- stage panels ------------------------------------------------ */}
      <div className="stack-6">
        {stages.ingest && (
          <StagePanel step="ingest" state={stages.ingest}>
            <IngestPanel data={stages.ingest.message.data as IngestStepData | undefined} />
          </StagePanel>
        )}

        {stages.redact && (
          <StagePanel step="redact" state={stages.redact}>
            <RedactPanel original={submittedText} data={stages.redact.message.data as RedactStepData} />
          </StagePanel>
        )}

        {stages.parse && (
          <StagePanel step="parse" state={stages.parse}>
            {parsed ? <ParsePanel parsed={parsed} /> : null}
          </StagePanel>
        )}

        {questions && (
          <section className="card-flat stack-4" style={{ borderStyle: "dashed" }}>
            <Label>Clarification needed</Label>
            <div className="display-sm">
              {questions.length === 1 ? "One question" : `${questions.length} questions`} before this can be sized
            </div>
            <p className="body-sm" style={{ maxWidth: "62ch" }}>
              The parser will not invent a round. An inflated record is the single failure that would end this
              product, so an ambiguous description stops here and asks rather than guessing.
            </p>
            <div className="stack-4">
              {questions.map((question) => (
                <label key={question} className="stack-2">
                  <span className="body-text" style={{ fontWeight: 400 }}>{question}</span>
                  <input
                    type="text"
                    className="field"
                    value={answers[question] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [question]: e.target.value }))}
                    disabled={running}
                  />
                </label>
              ))}
            </div>
            <div>
              <button
                type="button"
                className="btn-primary"
                disabled={running || !canAnswer}
                onClick={() => void run(answers)}
              >
                {running ? "Working…" : "Answer and continue"}
              </button>
            </div>
          </section>
        )}

        {stages.tier && (
          <StagePanel step="tier" state={stages.tier}>
            <TierPanel data={stages.tier.message.data as TierStepData} parsed={parsed} />
          </StagePanel>
        )}

        {stages.verify && (
          <StagePanel step="verify" state={stages.verify}>
            <VerifyPanel data={stages.verify.message.data as VerifyStepData | undefined} />
          </StagePanel>
        )}

        {stages.audit && (
          <StagePanel step="audit" state={stages.audit}>
            <AuditPanel data={stages.audit.message.data as AuditStepData} />
          </StagePanel>
        )}

        {stages.publish && (
          <StagePanel step="publish" state={stages.publish}>
            <PublishPanel data={stages.publish.message.data as PublishStepData | undefined} />
          </StagePanel>
        )}
      </div>

      {done && <DoneCard done={done} meta={meta} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StageRail({
  stages,
  active,
}: {
  stages: Partial<Record<PipelineStep, StageState>>;
  active: PipelineStep | null;
}) {
  return (
    <div
      className="card-flat"
      style={{ padding: 0, display: "grid", gridTemplateColumns: `repeat(${STEP_ORDER.length}, 1fr)` }}
    >
      {STEP_ORDER.map((step, i) => {
        const state = stages[step];
        const isActive = active === step;
        const status = state?.message.status;

        return (
          <div
            key={step}
            style={{
              padding: "14px 12px",
              borderLeft: i === 0 ? undefined : "1px solid var(--border)",
              background: isActive ? "rgba(21,34,56,0.04)" : undefined,
              opacity: state ? 1 : 0.42,
              transition: "background 0.3s ease, opacity 0.3s ease",
            }}
          >
            <div className="row" style={{ gap: 7, marginBottom: 6 }}>
              <span
                className={`dot ${statusDot(status)}${status === "running" ? " animate-pulse-ink" : ""}`}
                style={{ width: 5, height: 5 }}
              />
              <span className="label" style={{ fontSize: 9 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div
              className="mono-sm truncate-1"
              style={{ color: state ? "var(--ink)" : "var(--muted)", fontSize: 10.5 }}
            >
              {STEP_TITLE[step]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StagePanel({
  step,
  state,
  children,
}: {
  step: PipelineStep;
  state: StageState;
  children: React.ReactNode;
}) {
  const { status, message, engine, trace } = state.message;

  return (
    <section className="card-flat stack-4 animate-slide-up">
      <div className="row-between stack-mobile" style={{ alignItems: "flex-start", gap: 12 }}>
        <div className="stack-2">
          <div className="row" style={{ gap: 9 }}>
            <span className={`dot ${statusDot(status)}${status === "running" ? " animate-pulse-ink" : ""}`} />
            <Label>{STEP_TITLE[step]}</Label>
          </div>
          <div className="body-text" style={{ maxWidth: "72ch" }}>
            {status === "running" ? STEP_ACTIVITY[step] : message}
          </div>
        </div>
        {engine && <EngineBadge engine={engine} />}
      </div>

      {status !== "running" && children}

      {trace && trace.length > 0 && (
        <details>
          <summary
            className="label"
            style={{ cursor: "pointer", listStyle: "none", paddingTop: 4 }}
          >
            Show the rules that fired ({trace.length})
          </summary>
          <ul className="stack-2" style={{ listStyle: "none", paddingTop: 12 }}>
            {trace.map((line, i) => (
              <li key={i} className="mono-sm" style={{ color: "var(--muted)", display: "flex", gap: 10 }}>
                <span style={{ opacity: 0.5 }}>{String(i + 1).padStart(2, "0")}</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function IngestPanel({ data }: { data?: IngestStepData }) {
  if (!data) return null;

  return (
    <div className="stack-4">
      <div className="cols-3">
        <div className="stack-2">
          <Label>Messages read</Label>
          <span className="ticker display-md">{data.messageCount}</span>
        </div>
        <div className="stack-2">
          <Label>Last round reached</Label>
          <span className="body-text">{data.lastReachedLabel ?? "Unstated"}</span>
        </div>
        <div className="stack-2">
          <Label>Sender domain</Label>
          <span className="mono-sm">{data.fromDomain || "—"}</span>
        </div>
      </div>

      {data.messages.length > 0 && (
        <div className="stack-2">
          {data.messages.map((msg, i) => (
            <div
              key={`${msg.subject}-${i}`}
              className="card animate-slide-up"
              style={{ animationDelay: `${i * 90}ms`, opacity: 0, animationFillMode: "forwards", padding: "12px 16px" }}
            >
              <div className="row-between" style={{ gap: 12, alignItems: "flex-start" }}>
                <div className="stack-2">
                  <span className="body-text">{msg.subject}</span>
                  <span className="mono-sm" style={{ color: "var(--muted)" }}>
                    {msg.maskedFrom}
                    {msg.date ? ` · ${msg.date}` : ""}
                  </span>
                </div>
                <div className="row-wrap" style={{ justifyContent: "flex-end" }}>
                  {msg.signalLabels.length > 0 ? (
                    msg.signalLabels.map((label) => (
                      <span key={label} className="chip chip-ok">{label}</span>
                    ))
                  ) : (
                    <span className="chip">No round named</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="body-sm" style={{ fontSize: 12 }}>
        This is not inbox access. You forwarded the messages; the agent reads them to see how far
        the loop got. The mailbox never leaves this stage.
      </p>
    </div>
  );
}

/**
 * Blacks out the exact character ranges the redactor matched. The spans come
 * from `redact()` running on the server, so what looks struck through here is
 * what was actually removed before any reasoning happened.
 */
function RedactPanel({ original, data }: { original: string; data?: RedactStepData }) {
  if (!data) return null;

  const total = data.removed.reduce((n, r) => n + r.count, 0);
  const pieces: React.ReactNode[] = [];
  let cursor = 0;

  for (const [i, span] of data.spans.entries()) {
    if (span.start > cursor) pieces.push(<span key={`t${i}`}>{original.slice(cursor, span.start)}</span>);
    pieces.push(
      <span
        key={`r${i}`}
        className="redacted"
        style={{ animationDelay: `${i * 110}ms` }}
        title={`${span.kind} → ${span.replacement}`}
      >
        {original.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  }
  if (cursor < original.length) pieces.push(<span key="tail">{original.slice(cursor)}</span>);

  return (
    <div className="stack-4">
      <div
        className="card"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.9, whiteSpace: "pre-wrap" }}
      >
        {pieces}
      </div>

      {total > 0 ? (
        <div className="row-wrap">
          {data.removed.map((r) => (
            <span key={r.kind} className="chip chip-ok">
              {r.count} × {r.kind.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : (
        <div className="row-wrap">
          <span className="chip">Checked: email</span>
          <span className="chip">phone</span>
          <span className="chip">url</span>
          <span className="chip">handle</span>
          <span className="chip">known names</span>
        </div>
      )}

      <p className="body-sm" style={{ fontSize: 12 }}>
        Deterministic, always on, and it runs first. If it throws, the pipeline stops rather than falling back
        to the raw text.
      </p>
    </div>
  );
}

function ParsePanel({ parsed }: { parsed: ParsedProcess }) {
  const unlabelled = parsed.roundsTotal !== null ? parsed.roundsTotal - parsed.rounds.length : 0;

  return (
    <div className="stack-6">
      <div className="stack-3">
        <Label>Rounds detected</Label>
        <div className="stack-2">
          {parsed.rounds.map((round, i) => (
            <div
              key={round.index}
              className="card animate-slide-up row-between"
              style={{ animationDelay: `${i * 130}ms`, opacity: 0, animationFillMode: "forwards", padding: "12px 16px" }}
            >
              <div className="row" style={{ gap: 14 }}>
                <span className="label" style={{ fontSize: 9, minWidth: 18 }}>
                  {String(round.index).padStart(2, "0")}
                </span>
                <span className="body-text">{round.label}</span>
                <span className="chip">{ROUND_LABEL[round.type] ?? round.type}</span>
              </div>
              <span className={`chip ${round.cleared ? "chip-ok" : ""}`}>
                {round.cleared ? "Cleared" : "Not cleared"}
              </span>
            </div>
          ))}

          {unlabelled > 0 && (
            <div className="card-flat" style={{ borderStyle: "dashed", padding: "12px 16px" }}>
              <span className="body-sm">
                {unlabelled} further round{unlabelled === 1 ? "" : "s"} counted but not labelled — the
                description didn&rsquo;t name them, and the parser will not invent a label.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="split" style={{ gap: 32 }}>
        <div className="stack-3">
          <Label>Competencies</Label>
          <div className="stack-2">
            {parsed.competencies.map((c, i) => (
              <div
                key={c.name}
                className="row-between animate-slide-up"
                style={{ animationDelay: `${300 + i * 90}ms`, opacity: 0, animationFillMode: "forwards" }}
              >
                <span className="body-text">{c.name}</span>
                <span className={`chip ${c.depth === "assessed" ? "chip-ink" : ""}`}>
                  {DEPTH_LABEL[c.depth]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="stack-3">
          <Label>Generalised employer</Label>
          <dl className="stack-2">
            <Row term="Profile" value={describeEmployer(parsed)} />
            <Row term="Scope" value={describeScope(parsed) || "Not stated"} />
            <Row term="Loop length" value={parsed.loopLengthWeeks ? `${parsed.loopLengthWeeks} weeks` : "Not stated"} />
            <Row term="Outcome" value={OUTCOME_LABEL[parsed.outcome]} />
            <Row term="Process type" value={parsed.processType} />
          </dl>
          <p className="body-sm" style={{ fontSize: 12 }}>
            No company name is collected or retained at any point, so there is none to leak.
          </p>
        </div>
      </div>
    </div>
  );
}

function TierPanel({ data, parsed }: { data?: TierStepData; parsed: ParsedProcess | null }) {
  if (!data) return null;
  const disagreed = data.tier !== data.ruleTier;

  return (
    <div className="split" style={{ gap: 32 }}>
      <div className="stack-4">
        <Label>Tier</Label>
        <div className="row" style={{ gap: 14 }}>
          <span className="ticker display-md" style={{ textTransform: "capitalize" }}>{data.tier}</span>
          <TierBadge tier={data.tier} />
        </div>
        <div className="stack-2">
          <div className="row-between">
            <span className="label">Round-count confidence</span>
            <span className="mono-sm">{data.roundsConfidence.toFixed(2)}</span>
          </div>
          <div className="conf-bar">
            <div className="conf-bar-fill" style={{ width: `${Math.round(data.roundsConfidence * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="stack-3">
        <Label>How this was decided</Label>
        <dl className="stack-2">
          <Row term="Rounds cleared" value={String(data.roundsCleared)} />
          <Row term="Rule verdict" value={data.ruleTier} />
          <Row term="Recorded tier" value={data.tier} />
          <Row term="Brand" value="Not an input" />
        </dl>
        <p className="body-sm" style={{ fontSize: 12 }}>
          {disagreed
            ? `The proposal and the rule disagreed, so the lower of the two was recorded. Rules may only lower a tier, never raise it.`
            : `Rounds cleared is primary. A known offer rate can promote by at most one tier; loop length can only demote. ${
                parsed && parsed.roundsConfidence < 0.6 ? "Confidence under 0.6 caps this at verified." : ""
              }`}
        </p>
      </div>
    </div>
  );
}

function VerifyPanel({ data }: { data?: VerifyStepData }) {
  if (!data) return null;
  const { verification, domain, maskedSignal } = data;
  const matchChip = (ok: boolean, label: string) => (
    <span className={`chip ${ok ? "chip-ok" : "chip-warn"}`}>
      {label}: {ok ? "match" : "no match"}
    </span>
  );

  return (
    <div className="stack-6">
      <div className="cols-3">
        <div className="stack-2">
          <Label>Domain</Label>
          <span className="mono-sm">{domain || "—"}</span>
          <span className="body-sm" style={{ fontSize: 12 }}>{maskedSignal}</span>
        </div>
        <div className="stack-2">
          <Label>Company</Label>
          <span className="body-text">{verification.companyLabel}</span>
        </div>
        <div className="stack-2">
          <Label>Confidence</Label>
          <span className="ticker display-md">{verification.confidence.toFixed(2)}</span>
          <div className="conf-bar">
            <div className="conf-bar-fill" style={{ width: `${Math.round(verification.confidence * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="row-wrap">
        {matchChip(verification.companyMatch, "Company")}
        {matchChip(verification.roleMatch, "Role")}
        {matchChip(verification.processMatch, "Process")}
        <span className={`chip ${verification.status === "verified" ? "chip-ok" : "chip-warn"}`}>
          {verification.status.replace(/_/g, " ")}
        </span>
      </div>

      {verification.evidence.length > 0 && (
        <div className="stack-3">
          <Label>Public evidence</Label>
          <div className="stack-2">
            {verification.evidence.map((item) => (
              <div key={item.id} className="card stack-2">
                <div className="row-between" style={{ gap: 12 }}>
                  <span className="body-text">{item.claim}</span>
                  <span className={`chip ${item.kind === "live_public" ? "chip-ink" : ""}`}>
                    {item.kind === "live_public" ? "live" : "catalog"}
                  </span>
                </div>
                <span className="mono-sm" style={{ color: "var(--muted)" }}>{item.about}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {verification.inconsistencies.length > 0 && (
        <div className="stack-3">
          <Label>Inconsistencies</Label>
          <ul className="stack-2" style={{ listStyle: "none" }}>
            {verification.inconsistencies.map((line) => (
              <li key={line} className="body-sm">{line}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="body-sm" style={{ fontSize: 12, maxWidth: "72ch" }}>
        {verification.reasoning}
      </p>
    </div>
  );
}

/**
 * The privacy audit. The cohort counter is the measured number of published
 * records sharing this one's (tier, region, quarter) — the actual input to the
 * k-anonymity floor, not an illustration of one.
 */
function AuditPanel({ data }: { data?: AuditStepData }) {
  if (!data) return null;
  const { audit, cohortCount, kFloor } = data;
  const clears = cohortCount >= kFloor;

  return (
    <div className="stack-6">
      <div className="cols-3">
        <div className="stack-2">
          <Label>Re-identification risk</Label>
          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
            <Counter to={audit.riskScore} className="ticker" style={{ fontSize: 40, fontWeight: 300 }} />
            <span className="label">/ 100</span>
          </div>
        </div>

        <div className="stack-2">
          <Label>Cohort size (k)</Label>
          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
            <Counter to={cohortCount} className="ticker" style={{ fontSize: 40, fontWeight: 300 }} />
            <span className="label">floor k={kFloor}</span>
          </div>
          <span className={`chip ${clears ? "chip-ok" : "chip-stop"}`} style={{ alignSelf: "flex-start" }}>
            {clears ? "Clears the floor" : "Below the floor"}
          </span>
        </div>

        <div className="stack-2">
          <Label>Decision</Label>
          <div className="display-sm" style={{ textTransform: "capitalize" }}>{audit.decision}</div>
          <span
            className={`chip ${audit.decision === "publish" ? "chip-ok" : audit.decision === "generalize" ? "chip-warn" : "chip-stop"}`}
            style={{ alignSelf: "flex-start" }}
          >
            {audit.decision === "publish" ? "Anonymous enough" : "Not publishable as written"}
          </span>
        </div>
      </div>

      {audit.quasiIdentifiers.length > 0 && (
        <div className="stack-3">
          <Label>What narrows the pool</Label>
          <div className="stack-2">
            {audit.quasiIdentifiers.map((qi, i) => (
              <div key={`${qi.field}-${i}`} className="stack-2">
                <div className="row-between">
                  <span className="mono-sm">{qi.field.replace("employerProfile.", "")} = {qi.value}</span>
                  <span className="label">+{qi.contribution}</span>
                </div>
                <div className="conf-bar">
                  <div
                    className="conf-bar-fill"
                    style={{ width: `${Math.min(qi.contribution * 3, 100)}%`, transitionDelay: `${i * 90}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {audit.generalizations.length > 0 && (
        <div className="stack-3">
          <Label>Generalisations required first</Label>
          <div className="stack-2">
            {audit.generalizations.map((g, i) => (
              <div key={`${g.field}-${i}`} className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <span className="mono-sm" style={{ color: "var(--muted)" }}>
                  {g.field.replace("employerProfile.", "")}
                </span>
                <span className="mono-sm" style={{ textDecoration: "line-through", opacity: 0.6 }}>{g.from}</span>
                <span className="label">becomes</span>
                <span className="chip chip-warn">{g.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="body-sm" style={{ fontSize: 12, maxWidth: "76ch" }}>
        {audit.reason}
      </p>
    </div>
  );
}

function PublishPanel({ data }: { data?: PublishStepData }) {
  if (!data) {
    return (
      <p className="body-sm">
        Nothing was written to the public pool. The submission is stored privately, and it can be
        broadened and resubmitted.
      </p>
    );
  }

  const { record } = data;

  return (
    <div className="split" style={{ gap: 32, alignItems: "center" }}>
      <div className="stack-4">
        <Label>Anonymous record</Label>
        <div className="row" style={{ gap: 14 }}>
          <div className="ticker display-md">{record.id}</div>
          <TierBadge tier={record.tier} />
        </div>
        <p className="body-sm" style={{ fontSize: 12 }}>
          This label is all a recruiter ever sees. It is derived one-way from the row id and reveals
          nothing about who submitted it or when in the queue.
        </p>
        <div className="row-wrap">
          <Link href="/circuit" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            See it in the Circuit
          </Link>
          <Link href="/search" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            Search the pool
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <Seal />
      </div>
    </div>
  );
}

/** Draws itself once, on publish. */
function Seal() {
  return (
    <svg width={132} height={132} viewBox="0 0 132 132" aria-hidden="true">
      <circle
        cx="66"
        cy="66"
        r="62"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1"
        className="seal-path"
        style={{ ["--seal-len" as string]: 390 }}
        opacity="0.5"
      />
      <circle
        cx="66"
        cy="66"
        r="53"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1"
        strokeDasharray="2 5"
        opacity="0.4"
        className="spin-slow"
        style={{ transformOrigin: "66px 66px" }}
      />
      <g transform="translate(48 48) scale(1.5)" fill="var(--ink)">
        <path d="M12 1.5L13.5 10.5L22.5 12L13.5 13.5L12 22.5L10.5 13.5L1.5 12L10.5 10.5L12 1.5Z" />
      </g>
    </svg>
  );
}

function DoneCard({ done, meta }: { done: DoneMessage; meta: MetaMessage | null }) {
  const good = done.outcome === "published";

  return (
    <section
      className="card stack-4 animate-slide-up"
      style={{ borderColor: good ? "rgba(45,90,39,0.4)" : "var(--border)" }}
    >
      <div className="row-between stack-mobile" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <Mark size={15} />
          <Label>{OUTCOME_HEADLINE[done.outcome]}</Label>
        </div>
        <div className="row-wrap">
          {done.tier && <TierBadge tier={done.tier} />}
          {/* The handle is only shown when the record is actually live. Showing
              it on a held record would imply it is searchable when it isn't. */}
          {good && done.recordId && <span className="chip">{done.recordId}</span>}
          {!good && <span className="chip">Not published</span>}
          {meta && <span className="chip">{meta.persistenceLabel}</span>}
        </div>
      </div>
      <p className="body-text" style={{ maxWidth: "74ch" }}>{done.reason}</p>

      {good ? (
        <div className="row-wrap">
          <Link href="/circuit" className="btn-primary btn-sm" style={{ textDecoration: "none" }}>
            Open the Circuit
          </Link>
          <Link href="/search" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            Try a search
          </Link>
        </div>
      ) : (
        <div className="row-wrap">
          <Link href="/system" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            Why it was held
          </Link>
        </div>
      )}
    </section>
  );
}

// ---- small helpers --------------------------------------------------------

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="row-between" style={{ gap: 16 }}>
      <dt className="label">{term}</dt>
      <dd className="mono-sm" style={{ textAlign: "right", textTransform: "capitalize" }}>
        {value.replace(/_/g, " ")}
      </dd>
    </div>
  );
}

/** Counts up to a value the server computed. */
function Counter({
  to,
  className,
  style,
}: {
  to: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [n, setN] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || to === 0) {
      setN(to);
      return;
    }
    const started = performance.now();
    const duration = 750;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min((now - started) / duration, 1);
      // Ease-out cubic, so it settles rather than stopping dead.
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, reduced]);

  return (
    <span className={className} style={style}>
      {n}
    </span>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function statusDot(status?: string): string {
  switch (status) {
    case "ok":
      return "dot-ok";
    case "error":
      return "dot-stop";
    case "blocked":
      return "dot-warn";
    case "running":
      return "dot-ink";
    default:
      return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
