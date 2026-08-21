/**
 * SPF / DKIM / DMARC taken from the forwarded original, not invented.
 *
 * A missing Authentication-Results header is "unknown", never "pass".
 * The seal holds only when all three are explicitly pass.
 */

export type AuthVerdict = "pass" | "fail" | "softfail" | "neutral" | "none" | "unknown";

export interface MailAuthResult {
  spf: AuthVerdict;
  dkim: AuthVerdict;
  dmarc: AuthVerdict;
  source: "authentication-results" | "received-spf" | "dkim-signature" | "absent";
  sealHolds: boolean;
  summary: string;
}

const VERDICTS: AuthVerdict[] = ["pass", "fail", "softfail", "neutral", "none"];

function verdict(raw: string | undefined | null): AuthVerdict {
  const value = (raw ?? "").toLowerCase().trim();
  return (VERDICTS.find((v) => value.startsWith(v)) ?? "unknown") as AuthVerdict;
}

function pick(blob: string, key: "spf" | "dkim" | "dmarc"): AuthVerdict {
  const re = new RegExp(`\\b${key}\\s*=\\s*(pass|fail|softfail|neutral|none)\\b`, "i");
  const hit = blob.match(re);
  return verdict(hit?.[1]);
}

export function parseMailAuth(raw: string): MailAuthResult {
  const text = raw.replace(/\r\n/g, "\n");
  const start = text.search(/^Authentication-Results:/im);
  const receivedSpf = text.match(/^Received-SPF:\s*(\w+)/im)?.[1] ?? "";

  let spf: AuthVerdict = "unknown";
  let dkim: AuthVerdict = "unknown";
  let dmarc: AuthVerdict = "unknown";
  let source: MailAuthResult["source"] = "absent";

  if (start >= 0) {
    source = "authentication-results";
    const rest = text.slice(start);
    const end = rest.search(/\nFrom:\s/m);
    const blob = (end >= 0 ? rest.slice(0, end) : rest).slice(0, 2000);
    spf = pick(blob, "spf");
    dkim = pick(blob, "dkim");
    dmarc = pick(blob, "dmarc");
  } else if (receivedSpf) {
    source = "received-spf";
    spf = verdict(receivedSpf);
  }

  const sealHolds = spf === "pass" && dkim === "pass" && dmarc === "pass";
  const summary = sealHolds
    ? "SPF, DKIM and DMARC all pass on the original."
    : source === "absent"
      ? "No Authentication-Results on this mail. The seal is unknown — not assumed."
      : `spf=${spf} · dkim=${dkim} · dmarc=${dmarc}`;

  return { spf, dkim, dmarc, source, sealHolds, summary };
}

export function emptyMailAuth(): MailAuthResult {
  return {
    spf: "unknown",
    dkim: "unknown",
    dmarc: "unknown",
    source: "absent",
    sealHolds: false,
    summary: "No Authentication-Results on this mail. The seal is unknown — not assumed.",
  };
}
