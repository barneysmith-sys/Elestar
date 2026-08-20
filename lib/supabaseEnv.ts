/**
 * Supabase URL + publishable key. The publishable key is the public
 * `sb_publishable_…` value (or the legacy anon JWT). It may arrive as
 * NEXT_PUBLIC_* from the Supabase Next.js wizard, or as the server-only
 * names this repo already used. The service role key is never read here.
 */

export function supabaseUrl(): string | null {
  const value =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  return value || null;
}

export function supabasePublishableKey(): string | null {
  const value =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  return value || null;
}

export function supabaseServiceRoleKey(): string | null {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  return value || null;
}

export function supabaseAuthConfig(): { url: string; publishableKey: string } | null {
  const url = supabaseUrl();
  const publishableKey = supabasePublishableKey();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}
