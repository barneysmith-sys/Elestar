"use client";

/**
 * The system diagram: what actually happens to an interview process.
 *
 * The agent nodes correspond one-to-one with modules in the repository, and
 * each one is labelled with whether it is deterministic or model-backed —
 * because "which parts of this are real" is the first question anyone
 * technical asks, and the honest answer is a good answer.
 */

import { useEffect, useRef, useState } from "react";
import { Label } from "./primitives";

interface AgentSpec {
  name: string;
  does: string;
  module: string;
  kind: "deterministic" | "judgement";
}

const AGENTS: AgentSpec[] = [
  {
    name: "Redact",
    does: "Strips emails, phone numbers, URLs, handles and known names before any prompt is built.",
    module: "src/redact.ts",
    kind: "deterministic",
  },
  {
    name: "Structure",
    does: "Turns prose into typed rounds, competencies and depth. Asks rather than guesses.",
    module: "src/parseProcess.ts",
    kind: "judgement",
  },
  {
    name: "Tier",
    does: "Rounds cleared decides the tier. Rules may lower a proposal, never raise it. Brand is not an input.",
    module: "computeTier()",
    kind: "deterministic",
  },
  {
    name: "Verify",
    does: "Recruiter-email domain → public evidence → structured match. Mailbox never leaves the owner boundary.",
    module: "lib/reasoners/verify.ts",
    kind: "judgement",
  },
  {
    name: "Privacy audit",
    does: "Scores re-identification risk and enforces a k=8 cohort floor. Fails closed.",
    module: "src/redactionAudit.ts",
    kind: "judgement",
  },
  {
    name: "Publish",
    does: "Writes the anonymised projection. Identity has no column to live in.",
    module: "lib/store.ts",
    kind: "deterministic",
  },
  {
    name: "Match",
    does: "Ranks records on depth-weighted overlap and discounted recency. Always names a gap.",
    module: "src/matchRecords.ts",
    kind: "judgement",
  },
  {
    name: "Brief",
    does: "Separates known from inferred from unknown. Never skips more than half a loop.",
    module: "src/interviewBrief.ts",
    kind: "judgement",
  },
];

const INPUTS = ["Interview process", "Round descriptions", "Outcome, if stated", "Recruiter email (private signal)"];
const OUTPUTS = ["Anonymous record", "Ranked matches", "Interview brief"];

export function SystemModel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Only cycle while the diagram is on screen — an animation running in a
  // scrolled-past section is just battery.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.15 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setActiveIndex((i) => (i + 1) % AGENTS.length), 1900);
    return () => clearInterval(timer);
  }, [visible]);

  return (
    <section className="dark scan-host" ref={hostRef}>
      <div className="scan-line" aria-hidden="true" />

      <div className="wrap section">
        <div className="stack-4" style={{ marginBottom: 48 }}>
          <Label light>System</Label>
          <h2 className="display-lg" style={{ maxWidth: "22ch" }}>
            Where the agents operate
          </h2>
          <p className="lede" style={{ maxWidth: "64ch" }}>
            Eight stages between a description and reusable intelligence. Four of them are
            deterministic rules that behave identically every time and never depend on a model being
            available.
          </p>
        </div>

        <div className="split-narrow" style={{ gap: 40, alignItems: "start" }}>
          {/* inputs */}
          <div className="stack-4">
            <Label light>In</Label>
            {INPUTS.map((input) => (
              <div key={input} className="stack-2">
                <div className="body-text" style={{ fontSize: 13 }}>{input}</div>
                <div className={`flow-h${visible ? "" : " idle"}`} aria-hidden="true" />
              </div>
            ))}
          </div>

          {/* agents */}
          <div className="stack-3">
            {AGENTS.map((agent, i) => {
              const isActive = visible && i === activeIndex;
              return (
                <div key={agent.name} className={`agent-node${isActive ? " active" : " done"}`}>
                  <div className="row-between" style={{ gap: 16, marginBottom: 8 }}>
                    <div className="row" style={{ gap: 12 }}>
                      <span
                        className="dot"
                        style={{
                          background: "var(--dark-ink)",
                          animation: isActive ? "pulse-node 1s ease infinite" : undefined,
                          opacity: isActive ? 1 : 0.35,
                        }}
                      />
                      <span className="label-light" style={{ color: "var(--dark-ink)" }}>
                        {String(i + 1).padStart(2, "0")} · {agent.name}
                      </span>
                    </div>
                    <span
                      className={`engine-badge ${agent.kind === "deterministic" ? "engine-model" : "engine-deterministic"}`}
                    >
                      {agent.kind === "deterministic" ? "Deterministic" : "Judgement"}
                    </span>
                  </div>
                  <p className="body-sm" style={{ color: "var(--dark-muted)", maxWidth: "70ch" }}>
                    {agent.does}
                  </p>
                  <div className="mono-sm" style={{ color: "var(--dark-muted)", opacity: 0.7, marginTop: 8 }}>
                    {agent.module}
                  </div>

                  {isActive && <DataPacket />}
                </div>
              );
            })}
          </div>

          {/* outputs */}
          <div className="stack-4">
            <Label light>Out</Label>
            {OUTPUTS.map((output) => (
              <div key={output} className="stack-2">
                <div className={`flow-h${visible ? "" : " idle"}`} aria-hidden="true" />
                <div className="body-text" style={{ fontSize: 13 }}>{output}</div>
              </div>
            ))}
          </div>
        </div>

        <hr className="rule" style={{ margin: "48px 0 32px" }} />

        <div className="cols-3">
          <Note
            title="Deterministic never degrades"
            body="Redaction, the tier ladder, the k=8 floor, depth weighting and recency discounting are rules. They run the same way with or without an API key."
          />
          <Note
            title="Judgement degrades honestly"
            body="Without a model, the judgement stages fall back to transparent rule-based reasoners and every surface says so. Nothing is presented as reasoning that didn't happen."
          />
          <Note
            title="Privacy is a schema, not a filter"
            body="Anonymity is enforced in Postgres. A recruiter query cannot return an unreleased identity — it is not that the interface hides it."
          />
        </div>
      </div>
    </section>
  );
}

function DataPacket() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "#f5f0e6",
        boxShadow: "0 0 8px rgba(245,240,230,0.6)",
        animation: "packet-travel 1.4s ease-in-out infinite",
      }}
    />
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="stack-3">
      <div className="display-sm" style={{ fontSize: 17 }}>{title}</div>
      <p className="body-sm" style={{ color: "var(--dark-muted)" }}>{body}</p>
    </div>
  );
}
