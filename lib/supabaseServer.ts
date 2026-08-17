import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Anon-key client bound to the request's session cookies — this is how we
 * find out who the caller actually is. It is subject to RLS like any other
 * authenticated client; it is never used to write processes/dossiers
 * (that's lib/supabaseAdmin.ts, deliberately a separate module).
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // Route Handler responses set cookies via the Response itself;
        // refreshing the session isn't needed for a single POST, so this
        // is intentionally a no-op rather than a half-implemented one.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
