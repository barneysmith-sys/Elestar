import "server-only";

import { reasonMatch, reasonParse } from "./agents";
import { engineLabel, getCapabilities, persistenceLabel, reasoningEngine } from "./capabilities";
import { buildCircuitGraph } from "./circuitGraph";
import { circuitAdvice } from "./circuitAdvice";
import { listPublishedDossiers, monthsAgo } from "./store";
import type { PipelineMessage } from "./pipelineWire";
import { PROVE_INBOX } from "./ingest/types";

export async function* runScout(args: {
  role: string;
  signal?: AbortSignal;
}): AsyncGenerator<PipelineMessage> {
  const role = args.role.trim();
  const aborted = () => Boolean(args.signal?.aborted);

  const capabilities = getCapabilities();
  yield {
    kind: "meta",
    engine: reasoningEngine(),
    engineLabel: engineLabel(reasoningEngine()),
    persistence: capabilities.persistence,
    persistenceLabel: persistenceLabel(capabilities.persistence),
    authenticated: false,
    simulation: false,
    inbox: PROVE_INBOX,
  };

  yield {
    kind: "step",
    step: "identify",
    status: "running",
    event: "identified",
    message: "Reading the role for transferable assessments…",
  };
  const parsedRole = await reasonParse({ description: role });
  if (aborted()) return;
  yield {
    kind: "step",
    step: "identify",
    status: "ok",
    event: "identified",
    engine: parsedRole.engine,
    trace: parsedRole.trace,
    message: parsedRole.value.competencies.length
      ? `Role needs ${parsedRole.value.competencies.map((c) => c.name).slice(0, 4).join(", ")}.`
      : "Role parsed. Matching against published records only.",
  };

  yield {
    kind: "step",
    step: "match",
    status: "running",
    event: "matching",
    message: "Ranking published Circuit records…",
  };
  const published = await listPublishedDossiers();
  if (aborted()) return;
  const { value: matches, engine, trace } = await reasonMatch({
    roleDescription: role,
    candidates: published.map((d) => ({
      recordId: d.id,
      record: d.parsed,
      monthsAgo: monthsAgo(d.createdAt),
    })),
    limit: 8,
  });
  const byId = new Map(published.map((d) => [d.id, d]));
  const results = matches.flatMap((match) => {
    const record = byId.get(match.recordId);
    if (!record) return [];
    const advice = circuitAdvice(record.parsed);
    return [{
      match,
      record,
      alreadySampled: advice.alreadySampled,
      stillUnknown: advice.stillUnknown,
    }];
  });

  yield {
    kind: "step",
    step: "match",
    status: "ok",
    event: "verified",
    engine,
    trace,
    message: results.length
      ? `${results.length} published record${results.length === 1 ? "" : "s"} ranked.`
      : "No published records to rank.",
    data: {
      results: results.map(({ match, record, alreadySampled, stillUnknown }) => ({
        match,
        record,
        alreadySampled,
        stillUnknown,
      })),
      pool: published.length,
    },
  };

  yield {
    kind: "step",
    step: "place",
    status: "running",
    event: "placing",
    message: "Attaching evidenced Circuit neighbors…",
  };
  const graph = buildCircuitGraph(published);
  const top = results[0];
  const topId = top?.record.id ?? "";
  const neighbors = top
    ? graph.edges
        .filter((edge) => edge.from === topId || edge.to === topId)
        .map((edge) => ({
          id: edge.from === topId ? edge.to : edge.from,
          relationship: edge.relationship,
          confidence: edge.confidence,
          evidence: edge.evidence,
        }))
    : [];
  yield {
    kind: "step",
    step: "place",
    status: "ok",
    event: "placed",
    engine: "deterministic",
    message: top
      ? neighbors.length
        ? `${topId} sits next to ${neighbors.length} evidenced neighbor${neighbors.length === 1 ? "" : "s"}.`
        : `${topId} is in the Circuit with no evidenced neighbor yet.`
      : "Circuit placement skipped — empty pool.",
    data: {
      recordId: topId,
      pool: published.length,
      neighbors,
    },
  };

  yield {
    kind: "done",
    outcome: "scouted",
    recordId: topId || undefined,
    reason: results.length
      ? "Ranked against published Circuit records. Skip suggestions are only rounds already on those records."
      : "The Circuit has no published records to rank yet.",
  };
}
