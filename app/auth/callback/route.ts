import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRequestClient } from "../../../lib/supabaseServer";
import { persistOwnProfile } from "../../../lib/accountStore";
import { parseAccountRole } from "../../../lib/account";
import { originFromRequest } from "../../../lib/siteUrl";

export const dynamic = "force-dynamic";

/**
 * PKCE return from the confirmation email.
 * The Site URL used to be localhost, so the code landed on `/`. Middleware
 * forwards that here without touching the landing page.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const origin = originFromRequest(request);
  const code = request.nextUrl.searchParams.get("code");
  const nextParam = request.nextUrl.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  if (!code) {
    return NextResponse.redirect(`${origin}/signup?mode=signin&reason=missing-code`);
  }

  const supabase = await createSupabaseRequestClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/signup?mode=signin&reason=auth-offline`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/signup?mode=signin&reason=confirm-failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role =
    parseAccountRole(user?.app_metadata?.role) ?? parseAccountRole(user?.user_metadata?.role);
  if (role) {
    try {
      await persistOwnProfile(role);
    } catch {
      /* trigger may already have written the row */
    }
  }

  const dest = next ?? (role === "candidate" ? "/wall" : "/desk");
  return NextResponse.redirect(`${origin}${dest}`);
}
