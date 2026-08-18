/**
 * Shared visual primitives.
 *
 * These carry the parts of the design system that need logic — the four-rung
 * tier ladder, the engine badge that distinguishes real reasoning from
 * simulated, the provenance chips. Everything purely presentational stays in
 * globals.css.
 */

import type { Tier } from "../src/types";
import type { Engine } from "../lib/capabilities";
import type { Provenance } from "../lib/reasoners/brief";
import { TIER_MEANING } from "../lib/records";

export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 1.5L13.5 10.5L22.5 12L13.5 13.5L12 22.5L10.5 13.5L1.5 12L10.5 10.5L12 1.5Z" />
    </svg>
  );
}

export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span className="row" style={{ gap: 9 }}>
      <Mark size={size} />
      <span
        className="font-display"
        style={{ fontSize: size * 0.82, letterSpacing: "0.02em", fontWeight: 400 }}
      >
        Elestar
      </span>
    </span>
  );
}

export function TierBadge({ tier, title }: { tier: Tier; title?: boolean }) {
  return (
    <span className={`tier tier-${tier}`} title={title === false ? undefined : TIER_MEANING[tier]}>
      {tier}
    </span>
  );
}

/**
 * States which engine produced a result. Deliberately loud on the
 * deterministic path: a dashed border and muted ink read as provisional, so a
 * simulated step can never be mistaken for a model-backed one at a glance.
 */
export function EngineBadge({ engine, label }: { engine: Engine; label?: string }) {
  return (
    <span className={`engine-badge engine-${engine}`}>
      <span
        className="dot"
        style={{
          width: 5,
          height: 5,
          background: engine === "model" ? "currentColor" : "currentColor",
          opacity: engine === "model" ? 1 : 0.7,
        }}
      />
      {label ?? (engine === "model" ? "Live reasoning · model-backed" : "Demo mode · simulated reasoning")}
    </span>
  );
}

export function ProvenanceChip({ provenance }: { provenance: Provenance }) {
  return <span className={`prov prov-${provenance}`}>{provenance}</span>;
}

export function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <div className={light ? "label-light" : "label"}>{children}</div>;
}

/**
 * Section heading used across the product views: a mono kicker over an
 * editorial display line, which is the design system's core rhythm.
 */
export function SectionHead({
  kicker,
  title,
  sub,
  right,
}: {
  kicker: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="stack-4" style={{ marginBottom: 32 }}>
      <div className="row-between">
        <Label>{kicker}</Label>
        {right}
      </div>
      <h1 className="display-lg">{title}</h1>
      {sub && <p className="lede" style={{ maxWidth: "62ch" }}>{sub}</p>}
    </div>
  );
}

export function StatBlock({
  value,
  label,
  hint,
}: {
  value: string | number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="stack-2">
      <div className="ticker" style={{ fontSize: 34, fontWeight: 300 }}>
        {value}
      </div>
      <Label>{label}</Label>
      {hint && <div className="body-sm" style={{ fontSize: 12 }}>{hint}</div>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div
      className="card-flat stack-4"
      style={{ borderStyle: "dashed", padding: 40, alignItems: "flex-start" }}
    >
      <Label>Nothing here yet</Label>
      <div className="display-sm">{title}</div>
      <p className="body-sm" style={{ maxWidth: "56ch" }}>{body}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="card-flat stack-2"
      style={{ borderColor: "rgba(107,48,48,0.4)", background: "var(--stop-soft)" }}
    >
      <Label>Something went wrong</Label>
      <p className="body-sm" style={{ color: "var(--stop)" }}>{children}</p>
    </div>
  );
}
