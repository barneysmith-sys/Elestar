"use client";

import { useMemo, useState } from "react";
import { useRouter } from "../router";
import { fetchBrief, PROVE_INBOX, requestIntro, readSse, startScout } from "../elestar-api";
import { usePipeline, OUTCOME_HEADLINE } from "../usePipeline";
import type { DossierRecord } from "../../../lib/records";
import { describeEmployer, furthestRoundLabel } from "../../../lib/records";
import { InterviewBriefView } from "../components/InterviewBriefView";
import type { AnnotatedBrief } from "../../../lib/reasoners/brief";
import type { MatchResult } from "../../../src/types";
import { FIXTURE_CATALOG, FIXTURE_IDS, type FixtureId } from "../../../lib/ingest/fixtureCatalog";
import { STEP_TITLE, type IdentifyStepData, type PipelineMessage, type PublishStepData } from "../../../lib/pipelineWire";

const SAMPLE_ROLE = "Senior backend engineer. Distributed systems, API design, and production ownership at a Series B or later company.";

function FitMark({ n }: { n: number }) {
  return (
    <span className="font-mono text-[12px] tabular-nums" style={{ color: "var(--navy)" }}>
      {Math.round(n)}
    </span>
  );
}

function HiringDesk() {
  const { showToast } = useRouter();
  const [role, setRole] = useState(SAMPLE_ROLE);
  const [phase, setPhase] = useState<"compose" | "reading" | "list">("compose");
  const [matches, setMatches] = useState<{ match: MatchResult; record: DossierRecord }[]>([]);
  const [engineLabel, setEngineLabel] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [brief, setBrief] = useState<AnnotatedBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scoutLine, setScoutLine] = useState("");

  const run = async () => {
    if (!role.trim()) return;
    setPhase("reading");
    setActive(null);
    setBrief(null);
    setBriefError(null);
    setError(null);
    setScoutLine("Reading the role…");
    try {
      const next: { match: MatchResult; record: DossierRecord }[] = [];
      let label = "";
      const stream = await startScout(role.trim());
      await readSse(stream, (msg: PipelineMessage) => {
        if (msg.kind === "meta") label = msg.engineLabel;
        if (msg.kind === "step") {
          setScoutLine(msg.message);
          if (msg.step === "match" && msg.status === "ok") {
            const data = msg.data as {
              results?: { match: MatchResult; record: DossierRecord }[];
            } | undefined;
            next.length = 0;
            next.push(...(data?.results ?? []));
          }
        }
      });
      setMatches(next);
      setEngineLabel(label);
      setActive(next[0]?.record.id ?? null);
      setPhase("list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setPhase("compose");
    }
  };

  const row = matches.find((m) => m.record.id === active) ?? null;

  const loadBrief = async (recordId: string) => {
    setBrief(null);
    setBriefError(null);
    try {
      const body = await fetchBrief(recordId, role.trim());
      setBrief(body.brief);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Brief refused.");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-7 pt-10 pb-[90px]">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-end mb-10">
        <div>
          <p className="type-label mb-3">Desk · Hiring</p>
          <h1 className="type-hero">A role in sentences.</h1>
        </div>
        <p className="type-lede" style={{ marginBottom: 0 }}>
          The desk runs the same match reasoner as search, then places the
          shortlist on the Circuit from overlapping evidence. Company names
          are not in the pool. A full brief exists only after the candidate
          approves an intro.
        </p>
      </div>

      <div className="desk-compose mb-8">
        <label className="block type-label mb-2">The req</label>
        <textarea
          value={role}
          onChange={(e) => setRole(e.target.value)}
          rows={4}
          className="w-full bg-transparent outline-none text-[16px] leading-relaxed resize-none"
          style={{ color: "var(--foreground)" }}
        />
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-3)" }}>
            Published records only · k-anonymity already applied
          </span>
          <button
            type="button"
            onClick={() => void run()}
            className="btn ml-auto"
          >
            {phase === "reading" ? scoutLine || "Reading the wall" : "Read the wall"}
          </button>
        </div>
      </div>

      {error && <p className="font-mono text-[12px] mb-6">{error}</p>}

      {phase === "list" && (
        <div className="grid lg:grid-cols-[0.92fr_1.08fr] gap-8 lg:gap-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-4" style={{ color: "var(--muted-foreground)" }}>
              Proposed {matches.length} · {engineLabel}
            </p>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {matches.map((m, i) => {
                const on = active === m.record.id;
                return (
                  <button
                    key={m.record.id}
                    type="button"
                    onClick={() => {
                      setActive(m.record.id);
                      setBrief(null);
                      setBriefError(null);
                    }}
                    className="w-full text-left py-4 flex gap-3 items-start"
                    style={{ opacity: on ? 1 : 0.55 }}
                  >
                    <div className="w-11 h-11 flex-none grid place-items-center font-mono text-[10px]" style={{ background: "var(--secondary)", color: "var(--navy)" }}>
                      {m.record.id.slice(0, 4)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-display font-normal text-[18px] leading-none" style={{ color: "var(--navy)" }}>{m.record.id}</p>
                        <FitMark n={m.match.fitScore} />
                      </div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.1em] mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                        {String(i + 1).padStart(2, "0")} · {describeEmployer(m.record.parsed)} · {furthestRoundLabel(m.record.parsed)} · {m.record.evidence} · {m.record.tier}
                      </p>
                      <p className="text-[14px] leading-relaxed mt-2" style={{ color: "var(--muted-foreground)" }}>{m.match.rationale}</p>
                    </div>
                  </button>
                );
              })}
              {!matches.length && (
                <p className="py-6 text-[14px]" style={{ color: "var(--muted-foreground)" }}>No published records matched this req.</p>
              )}
            </div>
          </div>

          <div className="border p-6 md:p-8" style={{ borderColor: "var(--navy)", background: "color-mix(in srgb, var(--background) 70%, var(--card))" }}>
            {!row ? (
              <p className="font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>Select a row. Briefs generate only after an intro is approved.</p>
            ) : (
              <>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: "var(--ink-3)" }}>
                  {row.record.tier} · {furthestRoundLabel(row.record.parsed)}
                </p>
                <h2 className="font-display font-normal text-[28px] md:text-[32px] leading-none mb-2" style={{ color: "var(--navy)", letterSpacing: "-0.03em" }}>{row.record.id}</h2>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] mb-8" style={{ color: "var(--muted-foreground)" }}>
                  {describeEmployer(row.record.parsed)}
                </p>
                <p className="text-[15px] leading-relaxed mb-6" style={{ color: "var(--muted-foreground)" }}>{row.match.rationale}</p>
                {row.match.gaps.length > 0 && (
                  <p className="text-[14px] mb-6" style={{ color: "var(--muted-foreground)" }}>Gap on this req: {row.match.gaps.join(" ")}</p>
                )}
                <div className="flex flex-wrap gap-3 mb-8">
                  <button
                    type="button"
                    onClick={() => {
                      void requestIntro(row.record.id, role.trim())
                        .then(() => showToast("Intro requested. Approve it on Intros, then generate the brief."))
                        .catch((err: unknown) => showToast(err instanceof Error ? err.message : "Intro request failed."));
                    }}
                    className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 text-[var(--primary-foreground)]"
                    style={{ background: "var(--navy)" }}
                  >
                    Request intro
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadBrief(row.record.id)}
                    className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 border"
                    style={{ borderColor: "var(--navy)", color: "var(--navy)" }}
                  >
                    Generate brief
                  </button>
                </div>
                {briefError && <p className="text-[14px] mb-4" style={{ color: "var(--muted-foreground)" }}>{briefError}</p>}
                {brief && <InterviewBriefView brief={brief} />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ListingDesk() {
  const { showToast, setWallView } = useRouter();
  const { running, meta, stages, questions, done, error, run, answer } = usePipeline();
  const [text, setText] = useState("");
  const [fixture, setFixture] = useState<FixtureId>("canonical");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const parsed = (stages.identify?.message.data as IdentifyStepData | undefined)?.parsed ?? null;
  const published = (stages.publish?.message.data as PublishStepData | undefined)?.record;
  const visible = useMemo(() => Object.keys(stages), [stages]);

  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-7 pt-10 pb-[90px]">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-end mb-10">
        <div>
          <p className="type-label mb-3">Desk · Candidate</p>
          <h1 className="type-hero">Two paragraphs. Not a form.</h1>
        </div>
        <p className="text-[16px] leading-relaxed max-w-[42ch]" style={{ color: "var(--muted-foreground)" }}>
          Notes help the parser. Publication still requires forwarded mail at {PROVE_INBOX}. This desk runs the real pipeline, including privacy audit.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-8 lg:gap-12">
        <div>
          <div className="border p-4 md:p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <label className="block font-mono text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--muted-foreground)" }}>
              The loop
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              placeholder="Recruiter screen, technical, system design, then a final. Series B fintech. They went with another candidate."
              className="w-full bg-transparent outline-none text-[16px] leading-relaxed resize-none placeholder:opacity-50"
              style={{ color: "var(--foreground)" }}
            />
            <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
              <label className="block font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
                Simulate forwarded mail
              </label>
              <select
                value={fixture}
                onChange={(e) => setFixture(e.target.value as FixtureId)}
                className="w-full border px-3 py-2 text-[13px] bg-transparent"
                style={{ borderColor: "var(--border-2)", color: "var(--foreground)" }}
              >
                {FIXTURE_IDS.map((id) => (
                  <option key={id} value={id}>{FIXTURE_CATALOG[id].label}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void run({ description: text.trim() || FIXTURE_CATALOG[fixture].notes, fixture, simulation: true, role: FIXTURE_CATALOG[fixture].role })}
                  className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 text-[var(--primary-foreground)] disabled:opacity-40"
                  style={{ background: "var(--navy)" }}
                >
                  {running ? "Verifying" : "Run pipeline"}
                </button>
              </div>
            </div>
          </div>
          <p className="font-mono text-[10px] mt-3 leading-relaxed" style={{ color: "var(--ink-3)" }}>
            Simulation is labelled. The pipeline that runs is the same one production uses.
          </p>

          {questions && !done && (
            <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--border)" }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-4" style={{ color: "var(--navy)" }}>Clarify</p>
              {questions.questions.map((q) => (
                <div key={q} className="mb-4">
                  <p className="text-[15px] mb-2">{q}</p>
                  <input
                    value={answers[q] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                    className="w-full border px-3 py-2 text-[14px] outline-none"
                    style={{ borderColor: "var(--border-2)", background: "var(--card)", color: "var(--foreground)" }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => void answer(answers)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 border"
                style={{ borderColor: "var(--navy)", color: "var(--navy)" }}
              >
                Continue
              </button>
            </div>
          )}
        </div>

        <div>
          {!parsed && !done && !error && (
            <div className="border border-dashed p-6 md:p-8 min-h-[280px]" style={{ borderColor: "var(--border-2)" }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-4" style={{ color: "var(--ink-3)" }}>Pipeline</p>
              <p className="font-display font-normal text-[26px] leading-[1.1] mb-3" style={{ color: "var(--navy)", letterSpacing: "-0.03em" }}>
                Nothing is issued until verification finishes.
              </p>
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {visible.map((step) => STEP_TITLE[step as keyof typeof STEP_TITLE] ?? step).join(" → ") || "Waiting for inbound."}
              </p>
            </div>
          )}
          {error && <p className="text-[14px] mb-4">{error}</p>}
          {(parsed || done) && (
            <div className="border p-6 md:p-8" style={{ borderColor: "var(--navy)", background: "color-mix(in srgb, var(--background) 70%, var(--card))" }}>
              {meta?.simulation && (
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-5" style={{ color: "var(--ink-3)" }}>
                  Demo inbound · {meta.engineLabel}
                </p>
              )}
              <p className="font-display font-normal leading-none mb-3" style={{ fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "var(--navy)", letterSpacing: "-0.03em" }}>
                {published?.id ?? (done ? OUTCOME_HEADLINE[done.outcome] : describeEmployer(parsed!))}
              </p>
              {parsed && (
                <>
                  <p className="font-display font-normal text-[22px] leading-none mb-2">{furthestRoundLabel(parsed)}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] mb-8" style={{ color: "var(--verify)" }}>
                    {parsed.proposedTier} · confidence {parsed.roundsConfidence.toFixed(2)}
                  </p>
                  <div className="space-y-3 mb-8">
                    {parsed.rounds.map((r) => (
                      <div key={r.index} className="flex items-baseline justify-between gap-3 border-b pb-2" style={{ borderColor: "var(--border)" }}>
                        <p className="font-display font-normal text-[20px] leading-none" style={{ color: "var(--navy)" }}>{r.label}</p>
                        <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                          {String(r.index).padStart(2, "0")} · {r.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {done && (
                <p className="text-[14px] mb-6" style={{ color: "var(--muted-foreground)" }}>{done.reason}</p>
              )}
              {published && (
                <button
                  type="button"
                  onClick={() => {
                    showToast(`${published.id} is on the wall.`);
                    setWallView("wall");
                  }}
                  className="w-full font-mono text-[11px] uppercase tracking-[0.12em] py-3 text-[var(--primary-foreground)]"
                  style={{ background: "var(--navy)" }}
                >
                  On the wall · {published.id}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Desk({ locked }: { locked?: "firm" | "creative" }) {
  const { mode, setMode } = useRouter();
  const view = locked ?? mode;
  return (
    <>
      {!locked && (
      <div className="max-w-[1400px] mx-auto px-5 md:px-7 pt-6">
        <div className="flex border w-fit" style={{ borderColor: "var(--navy)" }}>
          {([
            { id: "firm" as const, label: "Hiring" },
            { id: "creative" as const, label: "Candidate" },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className="font-mono text-[11px] uppercase tracking-[0.12em] px-3.5 py-1.5"
              style={{
                background: view === t.id ? "var(--navy)" : "transparent",
                color: view === t.id ? "var(--primary-foreground)" : "var(--navy)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      )}
      {view === "firm" ? <HiringDesk /> : <ListingDesk />}
    </>
  );
}
