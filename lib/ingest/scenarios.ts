/**
 * Agent Lab scenarios. Each one runs the real pipeline with a labelled
 * simulation fixture — never mixed into production persistence as live mail.
 */

import { FIXTURE_CATALOG, type FixtureId } from "./fixtureCatalog";

export type LabExpect = "published" | "needs_clarification" | "pending_review" | "withheld";

export interface LabScenario {
  id: string;
  title: string;
  intent: string;
  fixture: FixtureId;
  expect: LabExpect;
}

export const LAB_SCENARIOS: LabScenario[] = [
  { id: "clean", title: "Clean verified candidate", intent: "A complete loop with catalog evidence should publish.", fixture: "canonical", expect: "published" },
  { id: "ambiguous", title: "Ambiguous candidate", intent: "Vague round counts must ask, not guess.", fixture: "healthtech", expect: "needs_clarification" },
  { id: "unknown", title: "Unknown company", intent: "An unknown domain is held. The agent does not invent a company.", fixture: "unknown", expect: "pending_review" },
  { id: "lookalike", title: "Lookalike company", intent: "A near-miss domain is not treated as the catalog company.", fixture: "lookalike", expect: "pending_review" },
  { id: "conflict", title: "Conflicting sources", intent: "Mail and notes that disagree are held, not silently resolved.", fixture: "contradiction", expect: "pending_review" },
  { id: "insufficient", title: "Insufficient evidence", intent: "No public catalog hit means insufficient evidence, not a verify.", fixture: "unknown", expect: "pending_review" },
  { id: "privacy", title: "Privacy failure", intent: "A too-specific small-company loop is withheld by k-anonymity.", fixture: "crypto", expect: "withheld" },
  { id: "verified", title: "Successful verification", intent: "Independent mail + catalog evidence can verify.", fixture: "canonical", expect: "published" },
  { id: "model", title: "Model failure", intent: "If the model is missing or fails, deterministic reasoners still run and say so.", fixture: "canonical", expect: "published" },
  { id: "tool", title: "Tool failure", intent: "Empty catalog research does not invent evidence.", fixture: "unknown", expect: "pending_review" },
  { id: "malformed", title: "Malformed email", intent: "Garbage input degrades; nothing publishes.", fixture: "malformed", expect: "withheld" },
  { id: "duplicate", title: "Duplicate email", intent: "The same simulation can be replayed; it stays labelled demo.", fixture: "canonical", expect: "published" },
  { id: "mailbox", title: "Recruiter mailbox", intent: "A personal mailbox is not a company signal.", fixture: "gmail", expect: "withheld" },
  { id: "full", title: "Full successful flow", intent: "Receive through publish, then Circuit / Search / Signals / Intro / Brief.", fixture: "canonical", expect: "published" },
];

export function scenarioFixtureNote(id: FixtureId): string {
  return FIXTURE_CATALOG[id]?.note ?? "";
}
