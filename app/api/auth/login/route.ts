import { getCapabilities } from "../../../../lib/capabilities";
import { parseAccountRole, parseEmail, parseLoginPassword, type AccountRole } from "../../../../lib/account";
import { ensureAccount } from "../../../../lib/accountStore";
import { createSupabaseRequestClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!getCapabilities().accounts) {
    return Response.json(
      { error: "Accounts are not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send email and password as JSON." }, { status: 400 });
  }

  const email = parseEmail((body as { email?: unknown }).email);
  const password = parseLoginPassword((body as { password?: unknown }).password);
  if (!email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const supabase = await createSupabaseRequestClient();
  if (!supabase) {
    return Response.json({ error: "Auth client is not configured." }, { status: 503 });
  }

  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user) {
    return Response.json({ error: "Email or password is wrong." }, { status: 401 });
  }

  let role: AccountRole | null = null;
  try {
    role = await ensureAccount(signedIn.data.user.id, parseAccountRole((body as { role?: unknown }).role));
  } catch {
    role = null;
  }

  return Response.json({
    authenticated: true,
    userId: signedIn.data.user.id,
    email: signedIn.data.user.email ?? email,
    role,
  });
}
