/**
 * Relationships between published anonymous records.
 *
 * Edges are derived from overlapping structured evidence — never invented
 * recruiter/company identity graphs. If two records do not share a sector
 * or an assessed competency, they are not connected.
 */

import type { DossierRecord } from "./records";
import { furthestRoundLabel } from "./records";

export interface CircuitNode {
  id: string;
  label: string;
  sector: string | null;
  stage: string | null;
  furthest: string;
  competencies: string[];
  evidence: string;
  demo: boolean;
}

export interface CircuitEdge {
  from: string;
  to: string;
  relationship: string;
  confidence: number;
  evidence: string[];
  relevance: string;
}

export interface CircuitGraph {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
}

export function buildCircuitGraph(records: DossierRecord[], limit = 24): CircuitGraph {
  const published = records.filter((r) => r.redactionDecision === "publish");
  const nodes: CircuitNode[] = published.map((record) => ({
    id: record.id,
    label: record.id,
    sector: record.parsed.employerProfile.sector,
    stage: record.parsed.employerProfile.stage,
    furthest: furthestRoundLabel(record.parsed),
    competencies: record.parsed.competencies
      .filter((c) => c.depth === "assessed" || c.depth === "probed")
      .map((c) => c.name),
    evidence: record.evidence,
    demo: record.demo,
  }));

  const edges: CircuitEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const shared = a.competencies.filter((name) => b.competencies.includes(name));
      const sameSector = Boolean(a.sector && a.sector === b.sector);
      if (!sameSector && shared.length === 0) continue;
      const union = new Set([...a.competencies, ...b.competencies]).size;
      const overlap = union === 0 ? 0 : shared.length / union;
      const confidence = Number(
        Math.min(0.95, overlap * 0.7 + (sameSector ? 0.2 : 0) + (a.furthest === b.furthest ? 0.1 : 0)).toFixed(2),
      );
      if (confidence < 0.2) continue;
      const evidence: string[] = [];
      if (sameSector && a.sector) evidence.push(`Same company type: ${a.sector}`);
      for (const name of shared.slice(0, 3)) evidence.push(`Both assessed ${name}`);
      if (a.furthest === b.furthest) evidence.push(`Same furthest stage: ${a.furthest}`);
      edges.push({
        from: a.id,
        to: b.id,
        relationship: sameSector && shared.length > 0 ? "shared loop signal" : sameSector ? "same company type" : "shared assessment",
        confidence,
        evidence,
        relevance: sameSector
          ? "A hiring team in this sector can compare how far each loop already got."
          : "The overlapping assessments are the only transferable signal.",
      });
    }
  }

  edges.sort((a, b) => b.confidence - a.confidence);
  return { nodes, edges: edges.slice(0, limit) };
}
