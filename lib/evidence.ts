/**
 * First-class evidence. Verification status is assigned by deterministic
 * rules, never by model prose.
 */

export type EvidenceStatus = "verified" | "probable" | "uncertain" | "contradicted" | "insufficient";
export type EvidenceSourceType = "mail" | "catalog" | "submission" | "independent";

export interface EvidenceItem {
  id: string;
  claim: string;
  source: string;
  sourceType: EvidenceSourceType;
  timestamp: string;
  confidence: number;
  status: EvidenceStatus;
  about: "company" | "role" | "process" | "recruiting" | "identity";
  contradictions: string[];
}

export interface EvidenceLedger {
  items: EvidenceItem[];
  independentSources: number;
  conflicts: string[];
  overall: EvidenceStatus;
}

export function emptyLedger(timestamp = new Date().toISOString()): EvidenceLedger {
  return { items: [], independentSources: 0, conflicts: [], overall: "insufficient" };
}

export function addEvidence(ledger: EvidenceLedger, item: Omit<EvidenceItem, "timestamp"> & { timestamp?: string }): EvidenceLedger {
  const next: EvidenceItem = { ...item, timestamp: item.timestamp ?? new Date().toISOString() };
  const items = [...ledger.items.filter((existing) => existing.id !== next.id), next];
  return summarise(items);
}

export function markConflicts(ledger: EvidenceLedger, conflicts: string[]): EvidenceLedger {
  if (conflicts.length === 0) return summarise(ledger.items);
  const items = ledger.items.map((item) =>
    conflicts.some((line) => item.claim.includes(line) || line.toLowerCase().includes(item.about))
      ? { ...item, status: "contradicted" as const, contradictions: [...new Set([...item.contradictions, ...conflicts])] }
      : item,
  );
  return summarise(items, conflicts);
}

export function summarise(items: EvidenceItem[], extraConflicts: string[] = []): EvidenceLedger {
  const sources = new Set(items.map((item) => item.sourceType));
  const conflicts = [...new Set([...extraConflicts, ...items.flatMap((item) => item.contradictions)])];
  const independentSources = sources.has("catalog") && sources.has("mail") ? 2 : sources.size;
  let overall: EvidenceStatus = "insufficient";
  if (items.length === 0) overall = "insufficient";
  else if (conflicts.length > 0) overall = "contradicted";
  else if (items.every((item) => item.status === "verified") && independentSources >= 2) overall = "verified";
  else if (items.some((item) => item.status === "verified" || item.status === "probable")) overall = "probable";
  else if (items.some((item) => item.status === "uncertain")) overall = "uncertain";
  return { items, independentSources, conflicts, overall };
}

export function claimStatusFromVerification(args: {
  status: "verified" | "needs_review" | "failed";
  inconsistencies: string[];
  evidenceCount: number;
}): EvidenceStatus {
  if (args.status === "failed" || args.inconsistencies.length > 0 && args.status !== "verified") {
    if (args.status === "failed") return "contradicted";
    if (args.evidenceCount === 0) return "insufficient";
    return args.inconsistencies.length > 0 ? "contradicted" : "uncertain";
  }
  if (args.status === "verified") return "verified";
  if (args.evidenceCount === 0) return "insufficient";
  return "uncertain";
}
