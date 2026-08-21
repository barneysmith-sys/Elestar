import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRequestClient } from "../../../lib/supabaseServer";
import { persistOwnProfile } from "../../../lib/accountStore";
import { parseAccountRole } from "../../../lib/account";
import { originFromRequest } from "../../../lib/siteUrl";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function destination(role: ReturnType<typeof parseAccountRole>, next: string | null): string {
  if (next) return next;
  return role === "candidate" ? "/verify" : "/desk";
}

export async function GET(request: NextRequest): Promise<Response> {
  const origin = originFromRequest(request);
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const nextParam = request.nextUrl.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  const supabase = await createSupabaseRequestClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/signup?mode=signin&reason=auth-offline`);
  }

  let error: { message: string } | null = null;
  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    error = exchanged.error;
  } else if (tokenHash && type && OTP_TYPES.includes(type as EmailOtpType)) {
    const verified = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    error = verified.error;
  } else {
    return NextResponse.redirect(`${origin}/signup?mode=signin&reason=missing-code`);
  }

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

  return NextResponse.redirect(`${origin}${destination(role, next)}`);
}
