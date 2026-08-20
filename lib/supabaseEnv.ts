/**
 * Supabase URL + publishable key. The publishable key is the public
 * `sb_publishable_…` value (or the legacy anon JWT). It may arrive as
 * NEXT_PUBLIC_* from the Supabase Next.js wizard, or as the server-only
 * names this repo already used. The service role key is never read here.
 *
 * On Vercel, fall back to the ELESTAR project publishable values so signup
 * works when dashboard env is missing. Local evals keep accounts off unless
 * keys are set. Never put the service role here.
 */

const ELESTAR_SUPABASE_URL = "https://cgrpbnzxcucekxuvnpjn.supabase.co";
const ELESTAR_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LB-6IiRKyVjyQ31DX88RNg_WDAnzaa-";

function onVercel(): boolean {
  return process.env.VERCEL === "1";
}

export function supabaseUrl(): string | null {
  const value =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    (onVercel() ? ELESTAR_SUPABASE_URL : "") ||
    "";
  return value || null;
}

export function supabasePublishableKey(): string | null {
  const value =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    (onVercel() ? ELESTAR_SUPABASE_PUBLISHABLE_KEY : "") ||
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
