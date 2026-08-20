import type { Tier } from "../../../src/types";

const COPY: Record<Tier, { top: string; bottom: string; filled: boolean }> = {
  apex: { top: "APEX", bottom: "", filled: true },
  elite: { top: "ELITE", bottom: "", filled: true },
  verified: { top: "VERI", bottom: "FIED", filled: true },
  standard: { top: "STD", bottom: "", filled: false },
};

export default function Seal({
  tier,
  size = 52,
  side = "right",
}: {
  tier: Tier;
  size?: number;
  side?: "left" | "right";
}) {
  const spec = COPY[tier];
  const filled = spec.filled;
  return (
    <div
      className={`absolute top-2.5 grid place-items-center ${side === "left" ? "left-2.5" : "right-2.5"}`}
      style={{ width: size, height: size, filter: "drop-shadow(0 3px 7px rgba(25,26,29,.28))" }}
    >
      <svg viewBox="0 0 52 52" className="absolute inset-0 w-full h-full">
        <circle
          cx="26"
          cy="26"
          r="24"
          fill={filled ? "var(--navy)" : "var(--card)"}
          stroke={filled ? "none" : "var(--navy)"}
          strokeWidth={filled ? 0 : 1.5}
        />
        <circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke={filled ? "rgba(255,255,255,.4)" : "rgba(25,26,29,.25)"}
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      </svg>
      <div
        className="relative font-mono font-medium text-center uppercase leading-[1.1]"
        style={{ fontSize: size * 0.15, letterSpacing: "0.04em", color: filled ? "var(--primary-foreground)" : "var(--navy)" }}
      >
        {spec.bottom ? (
          <>
            {spec.top}
            <br />
            {spec.bottom}
          </>
        ) : (
          spec.top
        )}
      </div>
    </div>
  );
}
