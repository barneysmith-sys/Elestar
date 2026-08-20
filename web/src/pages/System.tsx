"use client";

import { useEffect, useState } from "react";
import AppNav from "../components/AppNav";

type StatusPayload = {
  engine: string;
  engineLabel: string;
  persistence: boolean;
  persistenceLabel: string;
  inboundWebhook?: boolean;
  liveResearch?: boolean;
  allowSimulation?: boolean;
  requirePersistence?: boolean;
  kFloor: number;
  poolSize: number;
  alwaysReal: string[];
  degradesToDeterministic: string[];
};

export default function System() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/status", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Status could not be loaded.");
        return res.json() as Promise<StatusPayload>;
      })
      .then(setStatus)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Status could not be loaded."));
  }, []);

  return (
    <div style={{ minHeight: "100dvh" }}>
      <AppNav />
      <div className="max-w-[900px] mx-auto px-5 md:px-7 pt-10 pb-[90px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>System</p>
        <h1 className="font-display font-extralight leading-none mb-4" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", letterSpacing: "-0.045em", color: "var(--navy)" }}>
          What is real, and what degrades.
        </h1>
        {error && <p>{error}</p>}
        {status && (
          <>
            <p className="font-mono text-[11px] mb-8" style={{ color: "var(--ink-3)" }}>
              {status.engineLabel} · {status.persistenceLabel} · k={status.kFloor} · pool {status.poolSize}
              {status.inboundWebhook ? " · inbound webhook configured" : " · inbound webhook off"}
              {status.allowSimulation === false ? " · simulation disabled" : " · simulation allowed"}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Always real</p>
            <ul className="mb-10 space-y-2">
              {status.alwaysReal.map((item) => (
                <li key={item} className="text-[15px]">{item}</li>
              ))}
            </ul>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Judgement — degrades, and says so</p>
            <ul className="space-y-2">
              {status.degradesToDeterministic.map((item) => (
                <li key={item} className="text-[15px]">{item}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
