"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "../components/AppNav";
import { fetchStatus, PROVE_INBOX, type StatusPayload } from "../elestar-api";
import { usePipeline } from "../usePipeline";
import { type AuditStepData, type IdentifyStepData, type MatchStepData, type ParseMailStepData, type PublishStepData, type ResearchStepData, type ReviewStepData } from "../../../lib/pipelineWire";
import { describeEmployer, furthestRoundLabel } from "../../../lib/records";
import { FIXTURE_CATALOG, FIXTURE_IDS, type FixtureId } from "../../../lib/ingest/fixtureCatalog";
import { PipelineEvidence } from "../components/PipelineEvidence";
import { PipelineRail } from "../components/PipelineRail";
import { MailAuthPanel } from "../components/MailAuthPanel";
import { PatternReviewPanel } from "../components/PatternReviewPanel";

const REFUSALS = [
  { title: "Invent a round", body: "A vague quantifier emits the lower bound and drops confidence below 0.6, which caps the tier and routes the record to review. Ambiguity produces a question, not a guess." },
  { title: "Infer an outcome", body: "A rejection says the process ended, not why. The only negative-reading outcome requires the candidate to have stated it themselves." },
  { title: "Publish on a maybe", body: "Below k=8 cohort peers, or above the risk threshold, and the record is generalised or withheld. Every failure path ends somewhere other than the public pool." },
  { title: "Treat a lookalike as the company", body: "ledgerpayy.example is not ledgerpay.example. Unknown domains are held. Personal mailboxes are not a company signal." },
  { title: "Un-publish from a pattern flag", body: "Pattern review inspects the pool after a record is live. A flag is a note for a person. It cannot retract a published signal." },
];

export default function Verify() {
  const { running, meta, stages, active, questions, done, error, run, answer } = usePipeline();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [fixture, setFixture] = useState<FixtureId>("canonical");
  const [notes, setNotes] = useState(FIXTURE_CATALOG.canonical.notes);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [hot, setHot] = useState(false);

  const parsed = (stages.identify?.message.data as IdentifyStepData | undefined)?.parsed ?? null;
  const published = (stages.publish?.message.data as PublishStepData | undefined)?.record;
  const research = stages.research?.message.data as ResearchStepData | undefined;
  const match = stages.match?.message.data as MatchStepData | undefined;
  const audit = stages.audit?.message.data as AuditStepData | undefined;
  const mail = stages.parse_mail?.message.data as ParseMailStepData | undefined;
  const review = stages.review?.message.data as ReviewStepData | undefined;

  useEffect(() => {
    void fetchStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const startFile = async (file: File) => {
    const forwardedEmails = await file.text();
    void run({ forwardedEmails, description: notes.trim() || "Original recruiter email dropped in the product." });
  };

  return (
    <div style={{ minHeight: "100dvh" }}>
      <AppNav />
      <div className="max-w-[1180px] mx-auto px-5 md:px-7 pt-10 pb-[90px] grid lg:grid-cols-[1fr_1fr] gap-10">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Verify · centerpiece</p>
          <h1 className="font-display font-extralight leading-none mb-4" style={{ fontSize: "clamp(2.6rem, 6.5vw, 4.8rem)", letterSpacing: "-0.045em", color: "var(--navy)" }}>
            Forward the recruiter email.
          </h1>
          <p className="text-[16px] leading-relaxed max-w-[46ch] mb-8" style={{ color: "var(--muted-foreground)" }}>
            Elestar receives it at prove@elestar.ai, parses how far the loop got, checks SPF/DKIM/DMARC from the headers, researches the sender domain, then publishes only if verification and the privacy audit both clear.
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

          <div className="border p-5 mb-8" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--ink-3)" }}>
              {status?.inboundWebhook ? "Live inbound configured · fixtures remain labelled" : "Demo inbox · live mail is not configured"}
              {status ? ` · k=${status.kFloor} · ${status.engineLabel}` : ""}
            </p>
            <p className="text-[14px] mb-4" style={{ color: "var(--muted-foreground)" }}>
              {status?.inboundWebhook
                ? "Forward original recruiter mail to the address above. Fixtures below are simulations and cannot mix with live records."
                : "This host does not accept prove@elestar.ai until INBOUND_WEBHOOK_SECRET is set. Simulate a fixture; the pipeline that then runs is the real one."}
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

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-4" style={{ color: "var(--navy)" }}>What the pipeline refuses to do</p>
            <ul className="space-y-4">
              {REFUSALS.map((item) => (
                <li key={item.title}>
                  <p className="font-display text-[18px]" style={{ color: "var(--navy)" }}>{item.title}</p>
                  <p className="text-[14px] leading-relaxed mt-1" style={{ color: "var(--muted-foreground)" }}>{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border p-6 md:p-8 min-h-[420px]" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--background) 70%, var(--card))" }}>
          {meta && (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-6" style={{ color: "var(--ink-3)" }}>
              {meta.simulation ? "Simulated inbound · " : "Live inbound · "}{meta.engineLabel} · {meta.persistenceLabel}
            </p>
          )}
          {meta || running ? (
            <PipelineRail stages={stages} active={active} done={done ?? undefined} questions={Boolean(questions && !done)} error={error} />
          ) : (
            <p className="font-display text-[22px] leading-tight" style={{ color: "var(--navy)" }}>
              Waiting for inbound.
            </p>
          )}
          <MailAuthPanel auth={mail?.auth} />
          <PipelineEvidence
            identify={stages.identify?.message.data as IdentifyStepData | undefined}
            research={research}
            match={match}
            audit={audit}
          />
          <PatternReviewPanel review={review} />
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
          {done && published && (
            <div className="mt-6">
              <p className="font-mono text-[12px] mb-3">
                {published.id} · {describeEmployer(published.parsed)} · {furthestRoundLabel(published.parsed)}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/wall" className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--navy)" }}>Wall</Link>
                <Link href="/circuit" className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--navy)" }}>Circuit</Link>
                <Link href="/signals" className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--navy)" }}>Signals</Link>
                <Link href="/desk" className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--navy)" }}>Hire Scout</Link>
              </div>
            </div>
          )}
          {done && parsed && !published && (
            <p className="font-mono text-[12px] mt-4">{describeEmployer(parsed)} · {furthestRoundLabel(parsed)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
