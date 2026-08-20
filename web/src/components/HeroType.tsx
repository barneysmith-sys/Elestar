"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const LEAD = "Prove how far you got.";
const SUB = "Show the work. Forward the interview email. The next company can skip that round.";

function prefersReduce() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const TYPE_MS = 2000;
const LEAD_START = 40;
const SUB_GAP = 80;
const CHAR_MS = Math.max(
  8,
  Math.round((TYPE_MS - LEAD_START - SUB_GAP) / Math.max(1, LEAD.length + SUB.length - 2)),
);

function useTypewriter(text: string, ms: number, armed: boolean, startDelay = 240) {
  const [n, setN] = useState(() => (prefersReduce() ? text.length : 0));

  useEffect(() => {
    if (!armed) return;
    if (prefersReduce()) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    let t = 0;
    const tick = () => {
      i += 1;
      setN(i);
      if (i >= text.length) return;
      t = window.setTimeout(tick, ms);
    };
    t = window.setTimeout(tick, startDelay);
    return () => window.clearTimeout(t);
  }, [armed, text, ms, startDelay]);

  return n;
}

export default function HeroType({ onDone }: { onDone?: () => void }) {
  const reduce = prefersReduce();
  const [ready, setReady] = useState(reduce);
  const [span, setSpan] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const textRef = useRef<SVGTextElement>(null);
  const caretRef = useRef<SVGRectElement>(null);

  const leadN = useTypewriter(LEAD, CHAR_MS, ready, LEAD_START);
  const leadDone = leadN >= LEAD.length;
  const subN = useTypewriter(SUB, CHAR_MS, ready && (reduce || leadDone), SUB_GAP);
  const subDone = subN >= SUB.length;
  const sent = useRef(false);

  useEffect(() => {
    if (reduce) {
      setReady(true);
      return;
    }
    let cancel = false;
    const arm = () => {
      if (!cancel) setReady(true);
    };
    if (document.fonts?.ready) document.fonts.ready.then(arm);
    else arm();
    return () => {
      cancel = true;
    };
  }, [reduce]);

  useEffect(() => {
    if (!subDone || sent.current) return;
    sent.current = true;
    onDone?.();
  }, [subDone, onDone]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSpan(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const text = textRef.current;
    const caret = caretRef.current;
    if (!text || !caret) return;
    if (reduce || leadDone) {
      caret.setAttribute("opacity", "0");
      return;
    }
    try {
      const pos = text.getStartPositionOfChar(leadN);
      const size = Number.parseFloat(window.getComputedStyle(text).fontSize) || 48;
      caret.setAttribute("x", String(pos.x));
      caret.setAttribute("y", String(pos.y - size * 0.86));
      caret.setAttribute("height", String(size * 0.9));
      caret.setAttribute("opacity", "1");
    } catch {
      caret.setAttribute("opacity", "0");
    }
  }, [leadN, leadDone, reduce, span]);

  return (
    <h1 className="hero-type" style={{ color: "var(--navy)" }}>
      <span className="visually-hidden">{LEAD} {SUB}</span>
      <svg
        ref={svgRef}
        className="hero-type-lead"
        aria-hidden="true"
        overflow="visible"
      >
        <text
          ref={textRef}
          x={span > 0 ? span / 2 : "50%"}
          y="0.88em"
          fill="currentColor"
          xmlSpace="preserve"
          textAnchor="middle"
          fontFamily='"PP Editorial New", Fraunces, serif'
          fontWeight="200"
          fontSize="1em"
          letterSpacing="-0.05em"
        >
          {LEAD.split("").map((ch, i) => (
            <tspan key={`${ch}-${i}`} fillOpacity={i < leadN ? 1 : 0}>
              {ch}
            </tspan>
          ))}
        </text>
        <rect
          ref={caretRef}
          className="hero-type-caret"
          width="2"
          fill="currentColor"
          opacity="0"
        />
      </svg>
      <span className="hero-type-sub" aria-hidden="true">
        <span className="type-on">
          <span className="type-on-ghost" aria-hidden="true">{SUB}</span>
          <span className="type-on-live">
            {SUB.slice(0, subN)}
            {!reduce && !subDone && leadDone && <span className="caret" />}
          </span>
        </span>
      </span>
    </h1>
  );
}
