"use client";

import { useCallback, useEffect, useState } from "react";
import AppNav from "../components/AppNav";
import { decideIntro, fetchBrief, fetchIntros } from "../elestar-api";
import type { IntroRequest } from "../../../lib/records";
import { useRouter } from "../router";
import type { InterviewBrief } from "../../../src/types";

export default function Intros() {
  const { showToast } = useRouter();
  const [intros, setIntros] = useState<IntroRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<InterviewBrief | null>(null);

  const load = useCallback(() => {
    void fetchIntros()
      .then((data) => {
        setIntros(data.intros);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Intros could not be loaded."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ minHeight: "100dvh" }}>
      <AppNav />
      <div className="max-w-[900px] mx-auto px-5 md:px-7 pt-10 pb-[90px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Intros</p>
        <h1 className="font-display font-extralight leading-none mb-4" style={{ fontSize: "clamp(2.6rem, 6.5vw, 4.8rem)", letterSpacing: "-0.045em", color: "var(--navy)" }}>
          Identity only after approval.
        </h1>
        <p className="text-[16px] max-w-[46ch] mb-10" style={{ color: "var(--muted-foreground)" }}>
          A recruiter can request an intro. Nothing identifying is revealed until the candidate approves. A brief cannot be generated before that.
        </p>
        {error && <p className="mb-6">{error}</p>}
        {!intros.length && !error && (
          <p className="text-[15px]" style={{ color: "var(--muted-foreground)" }}>No intro requests yet. Request one from Search or the wall.</p>
        )}
        <ul className="space-y-4">
          {intros.map((intro) => (
            <li key={intro.id} className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <p className="font-display text-[22px]" style={{ color: "var(--navy)" }}>{intro.dossierId}</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] mt-1" style={{ color: "var(--muted-foreground)" }}>
                {intro.status} · {intro.roleDescription}
              </p>
              {intro.revealedIdentity && (
                <p className="text-[14px] mt-3">{intro.revealedIdentity.alias} · {intro.revealedIdentity.channel}</p>
              )}
              {intro.status === "pending" && (
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      void decideIntro(intro.id, "approved")
                        .then(() => { showToast("Intro approved."); load(); })
                        .catch((err: unknown) => showToast(err instanceof Error ? err.message : "Could not approve."));
                    }}
                    className="font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 text-white"
                    style={{ background: "var(--navy)" }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void decideIntro(intro.id, "declined")
                        .then(() => { showToast("Intro declined."); load(); })
                        .catch((err: unknown) => showToast(err instanceof Error ? err.message : "Could not decline."));
                    }}
                    className="font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 border"
                    style={{ borderColor: "var(--navy)", color: "var(--navy)" }}
                  >
                    Decline
                  </button>
                </div>
              )}
              {intro.status === "approved" && (
                <button
                  type="button"
                  className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 border"
                  style={{ borderColor: "var(--navy)", color: "var(--navy)" }}
                  onClick={() => {
                    void fetchBrief(intro.dossierId, intro.roleDescription, intro.id)
                      .then((body) => setBrief(body.brief))
                      .catch((err: unknown) => showToast(err instanceof Error ? err.message : "Brief refused."));
                  }}
                >
                  Generate brief
                </button>
              )}
            </li>
          ))}
        </ul>
        {brief && (
          <div className="mt-10 border p-6" style={{ borderColor: "var(--navy)" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-4" style={{ color: "var(--navy)" }}>Interview brief</p>
            <p className="text-[15px] mb-3">{brief.outcomeContext}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2">Already assessed</p>
            <ul className="mb-4">{brief.alreadyAssessed.map((a) => <li key={a.competency}>{a.competency} · {a.depth}</li>)}</ul>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2">Never skip</p>
            <p>{brief.neverSkip.join(" · ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
