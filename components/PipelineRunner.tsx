"use client";

/**
 * Verify-your-interview: the candidate forwards recruiter mail to
 * prove@elestar.ai. This page simulates that inbound for the demo, then runs
 * the real verification pipeline. The browser does not send email.
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
  type IdentifyStepData,
  type MatchStepData,
  type MetaMessage,
  type ParseMailStepData,
  type PipelineMessage,
  type PipelineStep,
  type PublishStepData,
  type ReceiveStepData,
  type ResearchStepData,
  type StepMessage,
} from "../lib/pipelineWire";
import {
  DEPTH_LABEL,
  OUTCOME_LABEL,
  ROUND_LABEL,
  describeEmployer,
  describeScope,
} from "../lib/records";
import { FIXTURE_IDS, INBOUND_FIXTURES, PROVE_INBOX, type FixtureId } from "../lib/ingest/inbound";
import { EngineBadge, ErrorNote, Label, Mark, TierBadge } from "./primitives";

const DWELL_MS: Record<PipelineStep, number> = {
  receive: 1400,
  parse_mail: 1800,
  identify: 2000,
  research: 1900,
  match: 2200,
  audit: 1900,
  publish: 1200,
};

interface StageState {
  message: StepMessage;
}

export function PipelineRunner({ initialText }: { initialText?: string }) {
  const [fixture, setFixture] = useState<FixtureId>("canonical");
  const [notes, setNotes] = useState(initialText ?? INBOUND_FIXTURES.canonical.notes);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [submittedText, setSubmittedText] = useState("");
  const [running, setRunning] = useState(false);
  const [meta, setMeta] = useState<MetaMessage | null>(null);
  const [stages, setStages] = useState<Partial<Record<PipelineStep, StageState>>>({});
  const [active, setActive] = useState<PipelineStep | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState<DoneMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const queue = useRef<PipelineMessage[]>([]);
  const draining = useRef(false);
  const cancelled = useRef(false);
  const selected = INBOUND_FIXTURES[fixture];

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
      setRunning(true);
      setInboxOpen(true);
      setSubmittedText([selected.notes, selected.raw].filter(Boolean).join("\n\n"));
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
            fixture,
            simulation: true,
            description: notes.trim() || selected.notes,
            priorAnswers,
            role: selected.role,
          }),
        });

        if (!res.ok || !res.body) {
          setError(
            res.status === 400
              ? "That inbound wasn't accepted."
              : "The pipeline couldn't start. Nothing was published.",
          );
          setRunning(false);
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
              /* ignore malformed frames */
            }
          }
          void drain();
        }

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
    [drain, fixture, notes, selected],
  );

  const parsed = (stages.identify?.message.data as IdentifyStepData | undefined)?.parsed ?? null;
  const canAnswer = questions !== null && questions.every((q) => (answers[q] ?? "").trim().length > 0);
  const arrival = (stages.receive?.message.data as ReceiveStepData | undefined)?.arrival;

  return (
    <div className="stack-8">
      <section className="card stack-5">
        <div className="row-between stack-mobile" style={{ gap: 12 }}>
          <div className="stack-2">
            <Label>Verify your interview</Label>
            <h2 className="display-sm" style={{ maxWidth: "22ch" }}>
              Forward the recruiter or interview email.
            </h2>
          </div>
          {meta && <EngineBadge engine={meta.engine} label={meta.engineLabel} />}
        </div>

        <p className="body-text" style={{ maxWidth: "62ch" }}>
          That&rsquo;s it. Elestar receives it at the address below, parses the interview
          signals, checks public evidence, and only then decides whether an anonymous
          record can publish. You do not type a recruiter address into this product.
        </p>

        <div className="card-flat row-between stack-mobile" style={{ padding: "16px 18px", gap: 12 }}>
          <div className="stack-2">
            <Label>Forward to</Label>
            <span className="mono-sm" style={{ fontSize: 16, color: "var(--ink)" }}>{PROVE_INBOX}</span>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              void navigator.clipboard.writeText(PROVE_INBOX);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? "Copied" : "Copy address"}
          </button>
        </div>
      </section>

      <section className="card-flat stack-4" style={{ borderStyle: "dashed" }}>
        <div className="row-between stack-mobile" style={{ gap: 12 }}>
          <div className="stack-2">
            <Label>Demo inbox</Label>
            <p className="body-sm" style={{ maxWidth: "64ch" }}>
              This Vercel demo cannot receive a real email. Click simulate to drop a
              synthetic recruiter thread into <span className="mono-sm">{PROVE_INBOX}</span> and
              watch the same pipeline production would run. The browser is not sending mail.
            </p>
          </div>
          <span className="chip chip-warn">DEMO · simulated ingest</span>
        </div>

        <div className="row-wrap">
          {FIXTURE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip hoverable${fixture === id ? " chip-ink" : ""}`}
              disabled={running}
              title={INBOUND_FIXTURES[id].note}
              onClick={() => {
                setFixture(id);
                setNotes(INBOUND_FIXTURES[id].notes);
                setInboxOpen(false);
              }}
            >
              {INBOUND_FIXTURES[id].label}
            </button>
          ))}
        </div>

        <div className="row-wrap" style={{ gap: 12 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={running}
            onClick={() => void run()}
          >
            {running ? "Processing inbound…" : "Simulate forwarded email"}
          </button>
          <span className="body-sm" style={{ fontSize: 12 }}>{selected.note}</span>
        </div>

        {(inboxOpen || arrival) && (
          <InboxPane
            to={PROVE_INBOX}
            from={arrival?.fromMasked ?? "t***@ledgerpay.example"}
            subject={arrival?.subject ?? previewSubject(selected.raw)}
            body={previewBody(selected.raw)}
            simulation
          />
        )}

        <details>
          <summary className="label" style={{ cursor: "pointer" }}>Notes the mail doesn&rsquo;t carry (optional)</summary>
          <textarea
            className="field"
            style={{ minHeight: 72, marginTop: 12 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={running}
            maxLength={8000}
            aria-label="Optional notes"
          />
        </details>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}

      {(running || Object.keys(stages).length > 0) && (
        <StageRail stages={stages} active={active} />
      )}

      <div className="stack-6">
        {stages.receive && (
          <StagePanel step="receive" state={stages.receive}>
            <p className="body-sm" style={{ fontSize: 12, maxWidth: "72ch" }}>
              {arrival?.simulation
                ? "Simulated ingest. Production triggers this same receive step when a real forward lands at prove@elestar.ai."
                : "Inbound accepted. The raw email stays on this side of the owner boundary."}
            </p>
          </StagePanel>
        )}

        {stages.parse_mail && (
          <StagePanel step="parse_mail" state={stages.parse_mail}>
            <ParseMailPanel
              original={submittedText}
              data={stages.parse_mail.message.data as ParseMailStepData | undefined}
            />
          </StagePanel>
        )}

        {stages.identify && (
          <StagePanel step="identify" state={stages.identify}>
            <IdentifyPanel data={stages.identify.message.data as IdentifyStepData | undefined} parsed={parsed} />
          </StagePanel>
        )}

        {questions && (
          <section className="card-flat stack-4" style={{ borderStyle: "dashed" }}>
            <Label>Clarification needed</Label>
            <div className="display-sm">
              {questions.length === 1 ? "One question" : `${questions.length} questions`} before this can be sized
            </div>
            <p className="body-sm" style={{ maxWidth: "62ch" }}>
              The parser will not invent a round. Ambiguity stops here and asks rather than guessing.
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
            <button
              type="button"
              className="btn-primary"
              disabled={running || !canAnswer}
              onClick={() => void run(answers)}
            >
              {running ? "Working…" : "Answer and continue"}
            </button>
          </section>
        )}

        {stages.research && (
          <StagePanel step="research" state={stages.research}>
            <ResearchPanel data={stages.research.message.data as ResearchStepData | undefined} />
          </StagePanel>
        )}

        {stages.match && (
          <StagePanel step="match" state={stages.match}>
            <MatchPanel data={stages.match.message.data as MatchStepData | undefined} />
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

function previewSubject(raw: string): string {
  const m = raw.match(/^Subject:\s*(.+)$/im);
  return m?.[1]?.trim() ?? "(no subject)";
}

function previewBody(raw: string): string {
  return raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/^From:\s*.+$/gim, "From: [recruiter]")
    .trim();
}

function InboxPane({
  to,
  from,
  subject,
  body,
  simulation,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
  simulation: boolean;
}) {
  return (
    <div className="card stack-3 animate-slide-up" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
      <div className="row-between">
        <span className="label">Inbox · {to}</span>
        {simulation && <span className="chip chip-warn">Simulation</span>}
      </div>
      <div className="stack-2">
        <div className="row-between"><span className="label">From</span><span>{from}</span></div>
        <div className="row-between"><span className="label">To</span><span>{to}</span></div>
        <div className="row-between" style={{ gap: 16 }}>
          <span className="label">Subject</span>
          <span style={{ textAlign: "right" }}>{subject}</span>
        </div>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--muted)", maxHeight: 220, overflow: "auto" }}>
        {body}
      </pre>
    </div>
  );
}

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
              padding: "14px 10px",
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
            <div className="mono-sm" style={{ color: state ? "var(--ink)" : "var(--muted)", fontSize: 10, lineHeight: 1.35 }}>
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
          <summary className="label" style={{ cursor: "pointer", listStyle: "none", paddingTop: 4 }}>
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

function maskPublicText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/^From:\s*.+$/gim, "From: [recruiter]");
}

function ParseMailPanel({ original, data }: { original: string; data?: ParseMailStepData }) {
  if (!data) return null;
  const total = data.removed.reduce((n, r) => n + r.count, 0);
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const [i, span] of data.spans.entries()) {
    if (span.start > cursor) {
      pieces.push(<span key={`t${i}`}>{maskPublicText(original.slice(cursor, span.start))}</span>);
    }
    pieces.push(
      <span key={`r${i}`} className="redacted" style={{ animationDelay: `${i * 110}ms` }} title={span.kind}>
        {span.replacement}
      </span>,
    );
    cursor = span.end;
  }
  if (cursor < original.length) pieces.push(<span key="tail">{maskPublicText(original.slice(cursor))}</span>);

  return (
    <div className="stack-4">
      <div className="cols-3">
        <div className="stack-2">
          <Label>Messages</Label>
          <span className="ticker display-md">{data.messageCount}</span>
        </div>
        <div className="stack-2">
          <Label>Last round reached</Label>
          <span className="body-text">{data.lastReachedLabel ?? "Unstated"}</span>
        </div>
        <div className="stack-2">
          <Label>Role extracted</Label>
          <span className="body-text">{data.extractedRole ?? "Unstated"}</span>
        </div>
      </div>
      <div className="row-wrap">
        {data.processSignals.map((s) => (
          <span key={s} className="chip chip-ok">{s}</span>
        ))}
      </div>
      {total > 0 && (
        <div className="card" style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
          {pieces}
        </div>
      )}
      <p className="body-sm" style={{ fontSize: 12 }}>
        Identifiers are stripped on the server before structuring. Subjects above are already redacted. The mailbox never leaves this stage.
      </p>
    </div>
  );
}

function IdentifyPanel({ data, parsed }: { data?: IdentifyStepData; parsed: ParsedProcess | null }) {
  if (!data) return null;
  const record = parsed ?? data.parsed;
  return (
    <div className="stack-6">
      <div className="cols-3">
        <div className="stack-2">
          <Label>Sender domain</Label>
          <span className="mono-sm">{data.recruiterDomain || "—"}</span>
        </div>
        <div className="stack-2">
          <Label>Role</Label>
          <span className="body-text">{data.role ?? "Unstated"}</span>
        </div>
        <div className="stack-2">
          <Label>Tier</Label>
          <div className="row" style={{ gap: 10 }}>
            <span className="ticker display-md" style={{ textTransform: "capitalize" }}>{data.tier}</span>
            <TierBadge tier={data.tier} />
          </div>
        </div>
      </div>
      <div className="stack-3">
        <Label>Rounds detected</Label>
        {record.rounds.map((round, i) => (
          <div
            key={round.index}
            className="card animate-slide-up row-between"
            style={{ animationDelay: `${i * 130}ms`, opacity: 0, animationFillMode: "forwards", padding: "12px 16px" }}
          >
            <div className="row" style={{ gap: 14 }}>
              <span className="label" style={{ fontSize: 9, minWidth: 18 }}>{String(round.index).padStart(2, "0")}</span>
              <span className="body-text">{round.label}</span>
              <span className="chip">{ROUND_LABEL[round.type] ?? round.type}</span>
            </div>
            <span className={`chip ${round.cleared ? "chip-ok" : ""}`}>{round.cleared ? "Cleared" : "Not cleared"}</span>
          </div>
        ))}
      </div>
      <dl className="stack-2">
        <Row term="Employer" value={describeEmployer(record)} />
        <Row term="Scope" value={describeScope(record) || "Not stated"} />
        <Row term="Outcome" value={OUTCOME_LABEL[record.outcome]} />
        <Row term="Round-count confidence" value={data.roundsConfidence.toFixed(2)} />
      </dl>
    </div>
  );
}

function ResearchPanel({ data }: { data?: ResearchStepData }) {
  if (!data) return null;
  return (
    <div className="stack-5">
      <div className="cols-3">
        <div className="stack-2">
          <Label>Company</Label>
          <span className="body-text">{data.companyLabel}</span>
        </div>
        <div className="stack-2">
          <Label>Evidence</Label>
          <span className={`chip ${data.found ? "chip-ok" : "chip-warn"}`}>
            {data.found ? data.evidenceKind : "none"}
          </span>
        </div>
        <div className="stack-2">
          <Label>Profile</Label>
          <span className="mono-sm">
            {[data.stage, data.sector].filter(Boolean).join(" · ") || "Unknown"}
          </span>
        </div>
      </div>
      {data.evidence.length > 0 && (
        <div className="stack-2">
          {data.evidence.map((item) => (
            <div key={item.id} className="card stack-2">
              <div className="row-between" style={{ gap: 12 }}>
                <span className="body-text">{item.claim}</span>
                <span className="chip">{item.kind === "live_public" ? "live" : "catalog"}</span>
              </div>
              <span className="mono-sm" style={{ color: "var(--muted)" }}>{item.about}</span>
            </div>
          ))}
        </div>
      )}
      <p className="body-sm" style={{ fontSize: 12 }}>
        Catalog evidence is labelled as such. This is not a live crawl of the company&rsquo;s site.
      </p>
    </div>
  );
}

function MatchPanel({ data }: { data?: MatchStepData }) {
  if (!data) return null;
  const { verification, structured } = data;
  const checks = verification.checks ?? [];
  const verified = verification.status === "verified";
  return (
    <div className="stack-5">
      <div className="row-between stack-mobile" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="stack-2">
          <Label>{verified ? "Verified" : verification.status.replace(/_/g, " ")}</Label>
          {structured.interview_signal && (
            <div className="display-sm">{structured.interview_signal}</div>
          )}
          <p className="body-sm" style={{ maxWidth: "62ch" }}>{verification.reasoning}</p>
        </div>
        <div className="stack-2" style={{ minWidth: 120, alignItems: "flex-end" }}>
          <Label>Confidence</Label>
          <span className="ticker display-md">{Math.round(verification.confidence * 100)}%</span>
          <div className="conf-bar" style={{ width: 120 }}>
            <div className="conf-bar-fill" style={{ width: `${Math.round(verification.confidence * 100)}%` }} />
          </div>
        </div>
      </div>
      {checks.length > 0 && (
        <ul className="stack-2" style={{ listStyle: "none" }}>
          {checks.map((check) => (
            <li key={check.id} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <span className={`chip ${check.pass ? "chip-ok" : "chip-warn"}`} style={{ minWidth: 22, justifyContent: "center" }}>
                {check.pass ? "✓" : "!"}
              </span>
              <span className="body-text">{check.label}</span>
            </li>
          ))}
        </ul>
      )}
      {verification.inconsistencies.length > 0 && (
        <div className="stack-2">
          <Label>What doesn&rsquo;t agree</Label>
          <ul className="stack-2" style={{ listStyle: "none" }}>
            {verification.inconsistencies.map((line) => (
              <li key={line} className="body-sm">{line}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="row-wrap">
        <span className="chip">{structured.recruiter_domain || "no domain"}</span>
        {structured.role && <span className="chip">{structured.role}</span>}
        <span className="mono-sm" style={{ color: "var(--muted)" }}>{data.maskedSignal}</span>
      </div>
    </div>
  );
}

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
        </div>
      </div>
      {audit.quasiIdentifiers.length > 0 && (
        <div className="stack-2">
          {audit.quasiIdentifiers.map((qi, i) => (
            <div key={`${qi.field}-${i}`} className="stack-2">
              <div className="row-between">
                <span className="mono-sm">{qi.field.replace("employerProfile.", "")} = {qi.value}</span>
                <span className="label">+{qi.contribution}</span>
              </div>
              <div className="conf-bar">
                <div className="conf-bar-fill" style={{ width: `${Math.min(qi.contribution * 3, 100)}%`, transitionDelay: `${i * 90}ms` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="body-sm" style={{ fontSize: 12, maxWidth: "76ch" }}>{audit.reason}</p>
    </div>
  );
}

function PublishPanel({ data }: { data?: PublishStepData }) {
  if (!data) {
    return (
      <p className="body-sm">
        Nothing was written to the public pool. The submission is stored privately.
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
        <div className="row-wrap">
          <Link href="/circuit" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>See it in the Circuit</Link>
          <Link href="/signals" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>Open Signals</Link>
        </div>
      </div>
      <Seal />
    </div>
  );
}

function Seal() {
  return (
    <svg width={132} height={132} viewBox="0 0 132 132" aria-hidden="true">
      <circle cx="66" cy="66" r="62" fill="none" stroke="var(--ink)" strokeWidth="1" className="seal-path" style={{ ["--seal-len" as string]: 390 }} opacity="0.5" />
      <circle cx="66" cy="66" r="53" fill="none" stroke="var(--ink)" strokeWidth="1" strokeDasharray="2 5" opacity="0.4" className="spin-slow" style={{ transformOrigin: "66px 66px" }} />
      <g transform="translate(48 48) scale(1.5)" fill="var(--ink)">
        <path d="M12 1.5L13.5 10.5L22.5 12L13.5 13.5L12 22.5L10.5 13.5L1.5 12L10.5 10.5L12 1.5Z" />
      </g>
    </svg>
  );
}

function DoneCard({ done, meta }: { done: DoneMessage; meta: MetaMessage | null }) {
  const good = done.outcome === "published";
  return (
    <section className="card stack-4 animate-slide-up" style={{ borderColor: good ? "rgba(45,90,39,0.4)" : "var(--border)" }}>
      <div className="row-between stack-mobile" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <Mark size={15} />
          <Label>{OUTCOME_HEADLINE[done.outcome]}</Label>
        </div>
        <div className="row-wrap">
          {done.tier && <TierBadge tier={done.tier} />}
          {good && done.recordId && <span className="chip">{done.recordId}</span>}
          {!good && <span className="chip">Not published</span>}
          {meta?.simulation && <span className="chip chip-warn">Simulated ingest</span>}
          {meta && <span className="chip">{meta.persistenceLabel}</span>}
        </div>
      </div>
      <p className="body-text" style={{ maxWidth: "74ch" }}>{done.reason}</p>
      {good ? (
        <div className="row-wrap">
          <Link href="/circuit" className="btn-primary btn-sm" style={{ textDecoration: "none" }}>Open the Circuit</Link>
          <Link href="/signals" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>See Signals</Link>
        </div>
      ) : (
        <Link href="/system" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>Why it was held</Link>
      )}
    </section>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="row-between" style={{ gap: 16 }}>
      <dt className="label">{term}</dt>
      <dd className="mono-sm" style={{ textAlign: "right", textTransform: "capitalize" }}>{value.replace(/_/g, " ")}</dd>
    </div>
  );
}

function Counter({ to, className, style }: { to: number; className?: string; style?: React.CSSProperties }) {
  const [n, setN] = useState(0);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (reduced || to === 0) {
      setN(to);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - started) / 750, 1);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, reduced]);
  return <span className={className} style={style}>{n}</span>;
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
    case "ok": return "dot-ok";
    case "error": return "dot-stop";
    case "blocked": return "dot-warn";
    case "running": return "dot-ink";
    default: return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
