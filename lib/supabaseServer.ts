import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Anon-key client bound to the request's session cookies — this is how we
 * find out who the caller actually is. It is subject to RLS like any other
 * authenticated client; it is never used to write processes/dossiers
 * (that's lib/supabaseAdmin.ts, deliberately a separate module).
 */

export function supabaseAuthConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export async function createSupabaseRequestClient() {
  const config = supabaseAuthConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: Array<{ name: string; value: string; options?: object }>) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Middleware refreshes the session.
        }
      },
    },
  });
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createSupabaseRequestClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
