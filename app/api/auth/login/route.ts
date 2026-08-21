import { getCapabilities } from "../../../../lib/capabilities";
import { parseAccountRole, parseEmail, parseLoginPassword, type AccountRole } from "../../../../lib/account";
import { ensureAccount, persistOwnProfile } from "../../../../lib/accountStore";
import { createSupabaseRequestClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!getCapabilities().accounts) {
    return Response.json(
      { error: "Accounts are not configured. Set SUPABASE_URL and the publishable (anon) key." },
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
    const needsConfirm = /confirm|not confirmed|email not confirmed/i.test(signedIn.error?.message ?? "");
    return Response.json(
      {
        error: needsConfirm
          ? "Confirm the email we sent before signing in. The link returns you here, signed in."
          : "Email or password is wrong.",
        pendingConfirmation: needsConfirm,
      },
      { status: needsConfirm ? 403 : 401 },
    );
  }

  let role: AccountRole | null = null;
  try {
    role = await ensureAccount(signedIn.data.user.id, parseAccountRole((body as { role?: unknown }).role));
  } catch {
    role = null;
  }
  if (role) {
    try {
      await persistOwnProfile(role);
    } catch {
      /* already present */
    }
  }

  return Response.json({
    authenticated: true,
    userId: signedIn.data.user.id,
    email: signedIn.data.user.email ?? email,
    role,
  });
}
