/**
 * Public origin for Auth emails and PKCE callbacks.
 * Confirmation links must land on the same host that started signup,
 * never a hardcoded localhost Site URL.
 */

export const PRODUCTION_ORIGIN = "https://elestar.vercel.app";

export function originFromHeaders(headers: {
  host?: string | null;
  proto?: string | null;
  forwardedHost?: string | null;
  origin?: string | null;
}): string {
  const originHeader = headers.origin?.trim();
  if (originHeader && /^https?:\/\//i.test(originHeader)) {
    return originHeader.replace(/\/$/, "");
  }

  const host = (headers.forwardedHost || headers.host || "").split(",")[0]?.trim();
  if (host) {
    const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const proto = local ? headers.proto || "http" : "https";
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
      : "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return PRODUCTION_ORIGIN;
}

export function originFromRequest(request: Request): string {
  return originFromHeaders({
    host: request.headers.get("host"),
    proto: request.headers.get("x-forwarded-proto"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    origin: request.headers.get("origin"),
  });
}

export function emailRedirectTo(request: Request): string {
  return `${originFromRequest(request)}/auth/callback`;
}

export function authRedirectAllowList(): string[] {
  return [
    `${PRODUCTION_ORIGIN}/**`,
    "https://elestar.ai/**",
    "https://www.elestar.ai/**",
    "https://*.vercel.app/**",
    "http://localhost:3000/**",
    "http://127.0.0.1:3000/**",
  ];
}
