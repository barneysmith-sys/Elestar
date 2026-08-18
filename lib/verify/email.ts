/**
 * Deterministic recruiter-email handling.
 *
 * The recruiter email is a verification credential, not identity and not
 * public data. This module is the only place that is allowed to look at the
 * raw address. Everything downstream receives a domain, never the mailbox.
 *
 * Personal-mailbox providers are rejected here rather than being "resolved"
 * into a fake company — a gmail.com address is not a recruiting signal.
 */

export interface RecruiterSignal {
  /** The original address, kept only for owner-side persistence. Never serialised onto a public payload. */
  email: string;
  domain: string;
  localPart: string;
  kind: "company" | "personal" | "invalid";
  reason: string;
}

const EMAIL_RE =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,}$/i;

/** Mailbox providers that cannot serve as a company verification signal. */
const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "fastmail.com",
  "hey.com",
]);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return null;
  return domain;
}

export function isPersonalDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.has(domain.toLowerCase());
}

export function parseRecruiterSignal(raw: string | undefined | null): RecruiterSignal {
  const email = normalizeEmail(raw ?? "");
  if (!email) {
    return {
      email: "",
      domain: "",
      localPart: "",
      kind: "invalid",
      reason: "No recruiter email was provided, so there is no company signal to verify against.",
    };
  }
  if (!EMAIL_RE.test(email)) {
    return {
      email,
      domain: extractDomain(email) ?? "",
      localPart: email.split("@")[0] ?? "",
      kind: "invalid",
      reason: "That does not look like an email address, so it cannot be used as a verification signal.",
    };
  }
  const domain = extractDomain(email)!;
  const localPart = email.slice(0, email.lastIndexOf("@"));
  if (isPersonalDomain(domain)) {
    return {
      email,
      domain,
      localPart,
      kind: "personal",
      reason: `${domain} is a personal mailbox provider, not a company domain. A recruiter signal has to come from the organisation that ran the process.`,
    };
  }
  return {
    email,
    domain,
    localPart,
    kind: "company",
    reason: `Extracted company domain ${domain} from the recruiter address. The mailbox itself is not used beyond this point.`,
  };
}

/** Mask used only in owner-facing processing UI. Never a public identifier. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "[redacted]";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

/**
 * Throws if a string that should be public still contains a recruiter email.
 * Used at publish / brief / circuit boundaries so a leak is a crash, not a display bug.
 */
export function assertNoRecruiterEmail(
  payload: unknown,
  recruiterEmail: string | string[] | undefined,
): void {
  const emails = (Array.isArray(recruiterEmail) ? recruiterEmail : recruiterEmail ? [recruiterEmail] : [])
    .map((e) => e.toLowerCase())
    .filter((e) => e.includes("@"));
  if (emails.length === 0) return;
  const serialised = JSON.stringify(payload).toLowerCase();
  for (const needle of emails) {
    if (serialised.includes(needle)) {
      throw new Error("assertNoRecruiterEmail: recruiter address reached a public boundary");
    }
  }
}

/** Every mailbox in a paste, used as the leak net for the event stream. */
export function collectEmails(...parts: (string | undefined | null)[]): string[] {
  const text = parts.filter(Boolean).join("\n");
  const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase()))];
}
