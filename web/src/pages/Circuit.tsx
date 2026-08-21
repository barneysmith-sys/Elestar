"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "../components/AppNav";
import { fetchCircuit, requestIntro } from "../elestar-api";
import { useRouter } from "../router";
import type { DossierRecord } from "../../../lib/records";
import { describeEmployer } from "../../../lib/records";
import { buildCircuitGraph, type CircuitEdge } from "../../../lib/circuitGraph";

export default function Circuit() {
  const { showToast, navigate } = useRouter();
  const [records, setRecords] = useState<DossierRecord[]>([]);
  const [meta, setMeta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [edge, setEdge] = useState<CircuitEdge | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCircuit()
      .then((data) => {
        if (cancelled) return;
        setRecords(data.records);
        setMeta(`${data.meta.persistenceLabel} · ${data.meta.engineLabel}`);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Circuit could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const graph = useMemo(() => buildCircuitGraph(records), [records]);
  const active = graph.nodes.find((n) => n.id === selected) ?? graph.nodes[0] ?? null;
  const related = graph.edges.filter((e) => active && (e.from === active.id || e.to === active.id));

  const width = 720;
  const height = 520;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.36;
  const positions = new Map(
    graph.nodes.map((node, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(graph.nodes.length, 1) - Math.PI / 2;
      return [node.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }] as const;
    }),
  );

  return (
    <div style={{ minHeight: "100dvh" }}>
      <AppNav />
      <div className="max-w-[1440px] mx-auto px-5 md:px-7 pt-10 pb-[90px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>Circuit</p>
        <h1 className="font-display font-extralight leading-none mb-4" style={{ fontSize: "clamp(2.6rem, 6.5vw, 4.8rem)", letterSpacing: "-0.045em", color: "var(--navy)" }}>
          Real overlap. Nothing invented.
        </h1>
        <p className="text-[16px] leading-relaxed max-w-[48ch] mb-4" style={{ color: "var(--muted-foreground)" }}>
          After Verify publishes, Place puts the record here from overlapping sector and competency evidence. Pattern review can flag a neighbor. It cannot invent an edge or retract the record.
        </p>
        <p className="font-mono text-[11px] mb-10" style={{ color: "var(--ink-3)" }}>
          {error ?? `${graph.nodes.length} records · ${graph.edges.length} evidenced links · ${meta}`}
        </p>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10">
          <div className="overflow-hidden border" style={{ borderColor: "var(--navy)", background: "color-mix(in srgb, var(--background) 70%, var(--card))" }}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Circuit of published interview records">
              {graph.edges.map((item) => {
                const a = positions.get(item.from);
                const b = positions.get(item.to);
                if (!a || !b) return null;
                const on = edge === item || (active && (item.from === active.id || item.to === active.id));
                return (
                  <line
                    key={`${item.from}-${item.to}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--navy)"
                    strokeWidth={on ? 2 : 1}
                    opacity={on ? 0.85 : 0.18}
                    onClick={() => setEdge(item)}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}
              {graph.nodes.map((node) => {
                const p = positions.get(node.id);
                if (!p) return null;
                const on = active?.id === node.id;
                return (
                  <g key={node.id} onClick={() => { setSelected(node.id); setEdge(null); }} style={{ cursor: "pointer" }}>
                    <circle cx={p.x} cy={p.y} r={on ? 18 : 12} fill={on ? "var(--navy)" : "var(--card)"} stroke="var(--navy)" strokeWidth="1.5" />
                    <text x={p.x} y={p.y + 32} textAnchor="middle" fontSize="11" fill="var(--navy)" fontFamily="ui-monospace, monospace">
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div>
            {!active && <p style={{ color: "var(--muted-foreground)" }}>No published records yet.</p>}
            {active && (
              <>
                <p className="edn-stamp text-[32px] leading-none mb-3" style={{ color: "var(--navy)" }}>{active.id}</p>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] mb-6" style={{ color: "var(--muted-foreground)" }}>
                  {active.sector ?? "sector unstated"} · {active.furthest} · {active.evidence}
                  {active.demo ? " · demo" : ""}
                </p>
                <p className="text-[14px] mb-8" style={{ color: "var(--muted-foreground)" }}>
                  {active.competencies.length
                    ? `Assessed: ${active.competencies.join(" · ")}`
                    : "No assessed competencies on this record."}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>
                  {related.length} evidenced relationship{related.length === 1 ? "" : "s"}
                </p>
                <ul className="space-y-4 mb-8">
                  {(edge ? [edge] : related.slice(0, 6)).map((item) => {
                    const other = item.from === active.id ? item.to : item.from;
                    return (
                      <li key={`${item.from}-${item.to}`}>
                        <button type="button" className="text-left w-full" onClick={() => setEdge(item)}>
                          <p className="font-display text-[18px]" style={{ color: "var(--navy)" }}>{other} · {item.relationship}</p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.12em] mt-1" style={{ color: "var(--ink-3)" }}>
                            Confidence {Math.round(item.confidence * 100)}%
                          </p>
                          <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>{item.evidence.join(" · ")}</p>
                          <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>{item.relevance}</p>
                        </button>
                      </li>
                    );
                  })}
                  {!related.length && (
                    <li className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                      No overlapping assessments with other published records. Isolation is honest.
                    </li>
                  )}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 text-[var(--primary-foreground)]"
                    style={{ background: "var(--navy)" }}
                    onClick={() => {
                      void requestIntro(active.id, "Open intro from Circuit.")
                        .then(() => showToast("Intro requested. Approve it on Intros."))
                        .catch((err: unknown) => showToast(err instanceof Error ? err.message : "Intro failed."));
                    }}
                  >
                    Request intro
                  </button>
                  <button
                    type="button"
                    className="font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 border"
                    style={{ borderColor: "var(--navy)", color: "var(--navy)" }}
                    onClick={() => navigate("board")}
                  >
                    Open on the wall
                  </button>
                </div>
                {records.find((r) => r.id === active.id) && (
                  <p className="font-mono text-[11px] mt-6" style={{ color: "var(--ink-3)" }}>
                    {describeEmployer(records.find((r) => r.id === active.id)!.parsed)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
