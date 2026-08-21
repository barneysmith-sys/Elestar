import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRequestClient } from "../../../lib/supabaseServer";
import { persistOwnProfile } from "../../../lib/accountStore";
import { parseAccountRole } from "../../../lib/account";
import { originFromRequest } from "../../../lib/siteUrl";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: NextRequest): Promise<Response> {
  const origin = originFromRequest(request);
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (!tokenHash || !type || !OTP_TYPES.includes(type as EmailOtpType)) {
    return NextResponse.redirect(`${origin}/signup?mode=signin&reason=confirm-failed`);
  }

  const supabase = await createSupabaseRequestClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/signup?mode=signin&reason=auth-offline`);
  }

  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });
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
      /* already present */
    }
  }

  return NextResponse.redirect(`${origin}${role === "candidate" ? "/wall" : "/desk"}`);
}
