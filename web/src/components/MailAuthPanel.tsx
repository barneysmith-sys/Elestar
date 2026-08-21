"use client";

import type { MailAuthResult } from "../../../lib/verify/mailAuth";

const ORDER: Array<{ id: keyof Pick<MailAuthResult, "spf" | "dkim" | "dmarc">; label: string }> = [
  { id: "spf", label: "spf" },
  { id: "dkim", label: "dkim" },
  { id: "dmarc", label: "dmarc" },
];

export function MailAuthPanel({ auth }: { auth?: MailAuthResult | null }) {
  if (!auth) return null;
  return (
    <div className="mt-6 border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)" }}>
        Authentication-Results · prove@elestar.ai
      </p>
      <ul className="font-mono text-[13px] space-y-1.5">
        {ORDER.map((row) => {
          const value = auth[row.id];
          const pass = value === "pass";
          return (
            <li key={row.id} style={{ color: pass ? "var(--verify)" : "var(--muted-foreground)" }}>
              {row.label}={value}
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] mt-3 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        {auth.summary}
      </p>
    </div>
  );
}
