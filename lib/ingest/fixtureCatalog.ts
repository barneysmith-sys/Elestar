/**
 * Demo inbound labels. No raw mail.
 *
 * The browser uses this list to pick a fixture id. The server loads the
 * matching thread in inbound.ts and runs the real pipeline.
 */

export const FIXTURE_IDS = [
  "canonical",
  "healthtech",
  "crypto",
  "pii",
  "mismatch",
  "gmail",
  "contradiction",
  "nda",
] as const;

export type FixtureId = (typeof FIXTURE_IDS)[number];

export interface FixtureMeta {
  id: FixtureId;
  label: string;
  note: string;
  role: string;
  notes: string;
}

export const FIXTURE_CATALOG: Record<FixtureId, FixtureMeta> = {
  canonical: {
    id: "canonical",
    label: "Full loop, rejected at the final",
    note: "Publishes. Four messages, three rounds cleared, outcome never stated.",
    role: "Senior Backend Engineer",
    notes: "Senior Backend Engineer at a Series B fintech.",
  },
  healthtech: {
    id: "healthtech",
    label: "Ambiguous round count",
    note: "Stops and asks. The parser will not guess a round count.",
    role: "Backend Engineer",
    notes: "Series A healthtech company, maybe 40 people. Recruiter screen then a few technical interviews. Never heard back.",
  },
  crypto: {
    id: "crypto",
    label: "Too identifiable to publish",
    note: "Blocked by the privacy audit. Small company, long specific loop.",
    role: "Head of Engineering",
    notes:
      "Recruiter screen, take-home, technical interview, system design, panel, and a final round at a 30 person seed stage crypto company in London over 8 weeks. They went with another candidate.",
  },
  pii: {
    id: "pii",
    label: "Contains contact details",
    note: "Shows identifiers being stripped before anything is structured.",
    role: "Senior Backend Engineer",
    notes:
      "Reach me at ada@example.com or +1 (415) 555-0199 — portfolio at https://ada.example.com, handle @adalovelace.\nSenior Backend Engineer at a Series B fintech.",
  },
  mismatch: {
    id: "mismatch",
    label: "Company mismatch",
    note: "Verification fails. Fintech loop against a healthcare recruiter domain.",
    role: "Senior Backend Engineer",
    notes: "Senior Backend Engineer at a Series B fintech.",
  },
  gmail: {
    id: "gmail",
    label: "Personal mailbox",
    note: "Verification fails. A gmail address is not a company signal.",
    role: "Senior Backend Engineer",
    notes: "Senior Backend Engineer at a Series B fintech.",
  },
  contradiction: {
    id: "contradiction",
    label: "Claim vs mail clash",
    note: "Holds for review. Notes claim a final; the mail only supports a screen.",
    role: "Senior Backend Engineer",
    notes:
      "I reached the final round. Recruiter screen, technical interview, system design, and a final panel at a Series B fintech.",
  },
  nda: {
    id: "nda",
    label: "Contains NDA material",
    note: "Confidential sentences are stripped. The loop can still verify.",
    role: "Senior Backend Engineer",
    notes:
      "Project Nightingale is under NDA. Do not share the internal architecture. Senior Backend Engineer at a Series B fintech.",
  },
};

export function isFixtureId(value: string | undefined | null): value is FixtureId {
  return Boolean(value && (FIXTURE_IDS as readonly string[]).includes(value));
}
