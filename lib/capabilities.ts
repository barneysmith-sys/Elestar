import { supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } from "./supabaseEnv";

/**
 * What this deployment is actually able to do right now.
 *
 * Elestar has two independent external dependencies — a model provider for
 * the judgement steps, and Supabase for persistence. Each can be absent, and
 * the product has to stay honest about which one is missing rather than
 * either crashing or quietly faking the part it can't do.
 *
 * The rule this file exists to enforce: deterministic Elestar logic
 * (redaction, tier rules, the k-anonymity floor, depth/recency weighting)
 * is ALWAYS real. Only the judgement steps degrade, and when they do the
 * result is labelled `deterministic` all the way to the UI.
 */

export type Engine = "model" | "deterministic";

export interface Capabilities {
  /** A model provider is configured, so judgement steps run for real. */
  model: boolean;
  /** Supabase is configured, so records persist and RLS applies. */
  persistence: boolean;
  /** Auth signup/login is available (project URL + publishable/anon key). */
  accounts: boolean;
  /** Signed inbound webhook for prove@elestar.ai is configured. */
  inboundWebhook: boolean;
  /** Optional live public fetch is enabled. Off by default; catalog is the v1 source. */
  liveResearch: boolean;
  /** When true, writes refuse to run on the in-memory store. */
  requirePersistence: boolean;
  /** When false, fixture/simulation requests are refused. */
  allowSimulation: boolean;
}

function flag(name: string, defaultTrue = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultTrue;
  return raw === "1" || raw === "true" || raw === "yes";
}

export function getCapabilities(): Capabilities {
  return {
    model: Boolean(process.env.ANTHROPIC_API_KEY),
    persistence: Boolean(supabaseUrl() && supabaseServiceRoleKey()),
    accounts: Boolean(supabaseUrl() && supabasePublishableKey()),
    inboundWebhook: Boolean(process.env.INBOUND_WEBHOOK_SECRET),
    liveResearch: flag("ELESTAR_LIVE_RESEARCH"),
    requirePersistence: flag("ELESTAR_REQUIRE_PERSISTENCE"),
    allowSimulation: flag("ELESTAR_ALLOW_SIMULATION", true),
  };
}

export function reasoningEngine(): Engine {
  return getCapabilities().model ? "model" : "deterministic";
}

/**
 * The single sentence the UI is allowed to show about its own honesty.
 * Deliberately not configurable — if reasoning is simulated, every surface
 * says so in the same words.
 */
export function engineLabel(engine: Engine): string {
  return engine === "model"
    ? "LIVE REASONING · MODEL-BACKED"
    : "DEMO MODE · SIMULATED REASONING";
}

export function persistenceLabel(persistence: boolean): string {
  return persistence ? "SUPABASE · RLS ENFORCED" : "DEMO STORE · IN-MEMORY";
}
