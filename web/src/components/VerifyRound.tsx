"use client";

import { useEffect, useMemo, useState } from "react";
import { PROVE_INBOX } from "../elestar-api";
import { usePipeline, OUTCOME_HEADLINE } from "../usePipeline";
import { STEP_ACTIVITY, STEP_ORDER, STEP_TITLE, type IdentifyStepData, type PublishStepData } from "../../../lib/pipelineWire";
import { describeEmployer, furthestRoundLabel } from "../../../lib/records";
import { useRouter } from "../router";

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="w-[15px] h-[15px]">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default function VerifyRound({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast, setWallView } = useRouter();
  const { running, meta, stages, active, questions, done, error, run, answer } = usePipeline();
  const [hot, setHot] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setHot(false);
      setAnswers({});
    }
  }, [open]);

  const started = running || Boolean(meta) || Boolean(done) || Boolean(error) || Boolean(questions);
  const parsed = (stages.identify?.message.data as IdentifyStepData | undefined)?.parsed ?? null;
  const published = (stages.publish?.message.data as PublishStepData | undefined)?.record;
  const visibleSteps = useMemo(
    () => STEP_ORDER.filter((step) => stages[step] || active === step),
    [stages, active],
  );

  if (!open) return null;

  const startSample = () => {
    void run({ fixture: "canonical", simulation: true });
  };

  const startFile = async (file: File) => {
    const forwardedEmails = await file.text();
    void run({
      forwardedEmails,
      description: "Original recruiter email dropped in the product.",
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-[rgba(25,26,29,.44)] backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="fixed z-[90] top-1/2 left-1/2 w-[min(520px,94vw)] max-h-[88vh] overflow-hidden rounded-2xl flex flex-col"
        style={{ background: "var(--background)", transform: "translate(-50%,-50%)", boxShadow: "0 30px 70px -20px rgba(25,26,29,.5)" }}
        role="dialog"
        aria-labelledby="verify-title"
      >
        <div className="px-[22px] py-5 border-b flex gap-3 items-start" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 id="verify-title" className="font-display font-normal text-xl tracking-tight">Add an interview</h3>
            <p className="text-[12.5px] mt-1.5 max-w-[42ch]" style={{ color: "var(--muted-foreground)" }}>
              Forward the original recruiter email to {PROVE_INBOX}. The pipeline verifies it. Nothing else in the inbox is read.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex-none w-[30px] h-[30px] rounded-lg border grid place-items-center text-base"
            style={{ borderColor: "var(--border-2)", color: "var(--foreground)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-[22px] overflow-y-auto flex-1">
          {!started && (
            <>
              <div
                className="rounded-[13px] p-7 text-center border-[1.5px] border-dashed transition-colors"
                style={{
                  borderColor: hot ? "var(--accent)" : "var(--border-2)",
                  background: hot ? "var(--navy-light)" : "var(--card)",
                }}
                onDragOver={(e) => { e.preventDefault(); setHot(true); }}
                onDragEnter={(e) => { e.preventDefault(); setHot(true); }}
                onDragLeave={() => setHot(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setHot(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void startFile(file);
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" className="mx-auto mb-2.5">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                <div className="font-display font-normal text-[15px]">Drop the original email here</div>
                <p className="text-xs mt-1.5 max-w-[34ch] mx-auto" style={{ color: "var(--muted-foreground)" }}>
                  In Gmail: open the interview email, click the menu, Show original, Download. Drag that .eml file in.
                </p>
                <button
                  type="button"
                  onClick={startSample}
                  className="mt-3.5 px-[15px] py-[9px] rounded-[9px] font-mono text-xs text-white active:translate-y-px active:scale-[0.98]"
                  style={{ background: "var(--foreground)" }}
                >
                  Simulate a forwarded email
                </button>
              </div>
              <p className="mt-4 text-[11.5px] leading-relaxed rounded-[10px] px-3.5 py-3" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                Prefer forwarding? Forward the email <b style={{ color: "var(--foreground)" }}>as attachment</b> to{" "}
                <span className="font-mono" style={{ color: "var(--accent)" }}>{PROVE_INBOX}</span>.
                A normal forward breaks the signature; forward as attachment keeps it intact.
              </p>
            </>
          )}

          {started && (
            <div className="flex flex-col">
              {meta?.simulation && (
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] mb-3" style={{ color: "var(--ink-3)" }}>
                  Demo mode · simulated inbound · real pipeline
                </p>
              )}
              {visibleSteps.map((step, i) => {
                const stage = stages[step];
                const ok = stage?.message.status === "ok" || stage?.message.status === "blocked" || stage?.message.status === "error";
                return (
                  <div key={step} className="flex gap-3 py-3.5 relative wall-card" style={{ animationDelay: "0ms" }}>
                    {i < visibleSteps.length - 1 && (
                      <span className="absolute left-[13px] top-[38px] bottom-[-2px] w-[1.5px]" style={{ background: "var(--border-2)" }} />
                    )}
                    <div
                      className="flex-none w-[27px] h-[27px] rounded-full grid place-items-center z-[1] text-white"
                      style={{ background: ok ? "var(--accent)" : "var(--ink-3)" }}
                    >
                      {ok ? CHECK : <span className="font-mono text-[9px]">{String(i + 1).padStart(2, "0")}</span>}
                    </div>
                    <div>
                      <h4 className="text-[13.5px] font-medium">{STEP_TITLE[step]}</h4>
                      <p className="font-mono text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                        {stage?.message.message ?? STEP_ACTIVITY[step]}
                      </p>
                    </div>
                  </div>
                );
              })}

              {error && (
                <p className="mt-2 text-[13px]" style={{ color: "var(--stop, #6b3030)" }}>{error}</p>
              )}

              {questions && !done && (
                <div className="mt-3 space-y-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--navy)" }}>Needs clarification</p>
                  {questions.questions.map((q) => (
                    <label key={q} className="block">
                      <span className="block text-[13px] mb-1.5">{q}</span>
                      <input
                        value={answers[q] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                        className="w-full border px-3 py-2 text-[14px] outline-none"
                        style={{ borderColor: "var(--border-2)", background: "var(--card)", color: "var(--foreground)" }}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={questions.questions.some((q) => !(answers[q] ?? "").trim())}
                    onClick={() => void answer(answers)}
                    className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 text-white disabled:opacity-40"
                    style={{ background: "var(--navy)" }}
                  >
                    Continue
                  </button>
                </div>
              )}

              {done && (
                <div className="mt-1.5 rounded-xl border p-[15px] flex items-center gap-3 wall-card" style={{ background: "var(--card)", borderColor: "var(--border)", animationDelay: "80ms" }}>
                  <div className="w-10 h-10 rounded-full grid place-items-center text-white flex-none" style={{ background: "var(--accent)" }}>
                    {CHECK}
                  </div>
                  <div>
                    <b className="edn-stamp text-[22px]">{OUTCOME_HEADLINE[done.outcome]}</b>
                    <span className="block font-mono text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {published
                        ? `${published.id} · ${describeEmployer(published.parsed)} · ${furthestRoundLabel(published.parsed)}`
                        : parsed
                          ? `${describeEmployer(parsed)} · ${furthestRoundLabel(parsed)}`
                          : done.reason}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {done && (
          <div className="px-[22px] pb-5">
            <button
              type="button"
              className="w-full py-3.5 rounded-xl font-mono text-[13px] text-white active:translate-y-px"
              style={{ background: "var(--accent)" }}
              onClick={() => {
                showToast(done.outcome === "published" ? "Anonymous record published to the wall." : done.reason);
                onClose();
                if (done.outcome === "published") setWallView("wall");
              }}
            >
              {done.outcome === "published" ? "Open the wall" : "Close"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
