import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const authReturn =
    pathname !== "/auth/callback" &&
    pathname !== "/auth/confirm" &&
    (searchParams.has("code") || searchParams.has("token_hash"));
  if (authReturn) {
    const url = request.nextUrl.clone();
    url.pathname = searchParams.has("token_hash") ? "/auth/confirm" : "/auth/callback";
    return NextResponse.redirect(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.png|icon.png|apple-icon.png|apple-touch-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
