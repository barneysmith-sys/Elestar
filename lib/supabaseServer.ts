import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAuthConfig } from "./supabaseEnv";

/**
 * Publishable-key client bound to the request's session cookies.
 * Subject to RLS. Never used to write processes/dossiers.
 */

export async function createSupabaseRequestClient() {
  const config = supabaseAuthConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
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
