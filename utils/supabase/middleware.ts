import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseAuthConfig } from "../../lib/supabaseEnv";

/**
 * Refresh the Auth cookie. Returns next() if keys are missing or Auth
 * throws, so a bad key cannot blank the site.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const config = supabaseAuthConfig();
  if (!config) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: Array<{ name: string; value: string; options?: object }>) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    return NextResponse.next();
  }

  return supabaseResponse;
}
