import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "./supabaseEnv";

/**
 * Service-role client. Import this ONLY from server-side code (Route
 * Handlers, Server Actions) — never from a client component. This is the
 * one and only path that writes to processes/dossiers/intro_requests;
 * RLS has no write policies for anon/authenticated on any of them, by
 * design, so this key is what makes writes possible at all.
 */
let client: SupabaseClient | null = null;

export function hasSupabaseAdmin(): boolean {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey());
}

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = supabaseUrl();
  const serviceKey = supabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Refusing to run the " +
        "publish pipeline without them rather than silently skip persistence.",
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
