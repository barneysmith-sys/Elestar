import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAuthConfig } from "../../lib/supabaseEnv";

export async function createClient() {
  const config = supabaseAuthConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: object }>) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component. Middleware refreshes the session.
        }
      },
    },
  });
}
