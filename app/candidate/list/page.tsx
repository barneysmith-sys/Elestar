"use client";

import { useState } from "react";

type StepName = "redact" | "parse" | "tier" | "audit" | "publish";
type StepStatus = "running" | "ok" | "error" | "blocked";

interface StepMessage {
  kind: "step";
  step: StepName;
  status: StepStatus;
  message: string;
  data?: unknown;
}
interface QuestionsMessage {
  kind: "questions";
  questions: string[];
  priorParse: unknown;
}
interface DoneMessage {
  kind: "done";
  outcome: "published" | "pending_review" | "withheld" | "needs_clarification";
  dossierId?: string;
  tier?: string;
  reason: string;
}
type PipelineMessage = StepMessage | QuestionsMessage | DoneMessage;

const STEP_ORDER: StepName[] = ["redact", "parse", "tier", "audit", "publish"];
const STEP_LABEL: Record<StepName, string> = {
  redact: "Redacting",
  parse: "Parsing your description",
  tier: "Computing tier",
  audit: "Checking anonymity",
  publish: "Publishing",
};

export default function CandidateListPage() {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [steps, setSteps] = useState<Partial<Record<StepName, StepMessage>>>({});
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState<DoneMessage | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  async function runStream(priorAnswers?: Record<string, string>) {
    setSubmitting(true);
    setSteps({});
    setQuestions(null);
    setDone(null);
    setFatalError(null);

    try {
      const res = await fetch("/candidate/list/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, priorAnswers }),
      });

      if (!res.ok || !res.body) {
        setFatalError(res.status === 401 ? "Please sign in first." : "Something went wrong. Please try again.");
        setSubmitting(false);
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
          const message = JSON.parse(line.slice("data: ".length)) as PipelineMessage;
          applyMessage(message);
        }
      }
    } catch {
      setFatalError("Lost connection while processing. Nothing was published — you can try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function applyMessage(message: PipelineMessage) {
    if (message.kind === "step") {
      setSteps((prev) => ({ ...prev, [message.step]: message }));
    } else if (message.kind === "questions") {
      setQuestions(message.questions);
    } else if (message.kind === "done") {
      setDone(message);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || submitting) return;
    void runStream();
  }

  function handleAnswersSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runStream(answers);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">List a process</h1>
      <p className="mt-2 text-neutral-600">
        Describe the interview loop in your own words — as much detail as you want. We redact anything
        identifying before it reaches a model, and nothing publishes without your review.
      </p>

      {!questions && (
        <form onSubmit={handleSubmit} className="mt-8">
          <textarea
            className="w-full min-h-[200px] rounded-lg border border-neutral-300 p-4 text-base focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="I interviewed at a Series B fintech, maybe 300 people, for a senior backend role. Recruiter screen, then a coding round…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            maxLength={8000}
          />
          <button
            type="submit"
            disabled={submitting || !description.trim()}
            className="mt-4 rounded-lg bg-neutral-900 px-5 py-2.5 text-white disabled:opacity-40"
          >
            {submitting ? "Working…" : "Submit"}
          </button>
        </form>
      )}

      {questions && (
        <form onSubmit={handleAnswersSubmit} className="mt-8 space-y-4">
          <p className="text-sm font-medium text-neutral-700">
            A couple of quick questions before we can size this correctly:
          </p>
          {questions.map((q) => (
            <label key={q} className="block">
              <span className="block text-sm text-neutral-700">{q}</span>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                value={answers[q] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                disabled={submitting}
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={submitting || questions.some((q) => !answers[q]?.trim())}
            className="rounded-lg bg-neutral-900 px-5 py-2.5 text-white disabled:opacity-40"
          >
            {submitting ? "Working…" : "Continue"}
          </button>
        </form>
      )}

      {fatalError && <p className="mt-6 text-sm text-red-700">{fatalError}</p>}

      {Object.keys(steps).length > 0 && (
        <ol className="mt-8 space-y-3">
          {STEP_ORDER.filter((s) => steps[s]).map((s) => {
            const m = steps[s]!;
            return (
              <li key={s} className="flex items-start gap-3">
                <StatusDot status={m.status} />
                <div>
                  <div className="text-sm font-medium text-neutral-900">{STEP_LABEL[s]}</div>
                  <div className="text-sm text-neutral-600">{m.message}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {done && (
        <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{outcomeLabel(done.outcome)}</div>
          {done.tier && <div className="mt-1 text-lg font-medium">Tier: {done.tier}</div>}
          <p className="mt-2 text-sm text-neutral-700">{done.reason}</p>
        </div>
      )}
    </main>
  );
}

function outcomeLabel(outcome: DoneMessage["outcome"]): string {
  switch (outcome) {
    case "published":
      return "Published";
    case "pending_review":
      return "Pending human review";
    case "withheld":
      return "Held privately";
    case "needs_clarification":
      return "Needs clarification";
  }
}

function StatusDot({ status }: { status: StepStatus }) {
  const color =
    status === "ok"
      ? "bg-green-600"
      : status === "error"
        ? "bg-red-600"
        : status === "blocked"
          ? "bg-amber-500"
          : "bg-neutral-400 animate-pulse";
  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}
