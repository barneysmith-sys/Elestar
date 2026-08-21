import { getCapabilities } from "../../../../lib/capabilities";
import { parseAccountRole, parseEmail, parsePassword } from "../../../../lib/account";
import { persistOwnProfile, provisionAccount } from "../../../../lib/accountStore";
import { getSupabaseAdmin, hasSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { createSupabaseRequestClient } from "../../../../lib/supabaseServer";
import { emailRedirectTo } from "../../../../lib/siteUrl";

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
    return Response.json({ error: "Send email, password, and role as JSON." }, { status: 400 });
  }

  const email = parseEmail((body as { email?: unknown }).email);
  const password = parsePassword((body as { password?: unknown }).password);
  const role = parseAccountRole((body as { role?: unknown }).role);
  if (!email) return Response.json({ error: "Enter a valid work email." }, { status: 400 });
  if (!password) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!role) return Response.json({ error: "Choose candidate or hiring." }, { status: 400 });

  const supabase = await createSupabaseRequestClient();
  if (!supabase) {
    return Response.json({ error: "Auth client is not configured." }, { status: 503 });
  }

  if (hasSupabaseAdmin()) {
    const admin = getSupabaseAdmin();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
    });
    if (created.error || !created.data.user) {
      const duplicate = /already been registered|already exists/i.test(created.error?.message ?? "");
      return Response.json(
        { error: duplicate ? "An account with that email already exists. Sign in instead." : "Could not create the account." },
        { status: duplicate ? 409 : 400 },
      );
    }

    try {
      await provisionAccount(created.data.user.id, role);
    } catch {
      await admin.auth.admin.deleteUser(created.data.user.id);
      return Response.json({ error: "Could not finish creating the account." }, { status: 500 });
    }
  } else {
    const signedUp = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
        emailRedirectTo: emailRedirectTo(request),
      },
    });
    if (signedUp.error || !signedUp.data.user) {
      const duplicate = /already been registered|already exists|already registered/i.test(signedUp.error?.message ?? "");
      return Response.json(
        { error: duplicate ? "An account with that email already exists. Sign in instead." : "Could not create the account." },
        { status: duplicate ? 409 : 400 },
      );
    }
    const alreadyRegistered = (signedUp.data.user.identities?.length ?? 1) === 0;
    if (alreadyRegistered) {
      return Response.json(
        { error: "An account with that email already exists. Sign in instead." },
        { status: 409 },
      );
    }
  }

  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session || !signedIn.data.user) {
    const needsConfirm = /confirm|not confirmed|email not confirmed/i.test(signedIn.error?.message ?? "");
    return Response.json({
      authenticated: false,
      created: true,
      pendingConfirmation: true,
      email,
      role,
      ...(needsConfirm || !hasSupabaseAdmin()
        ? {}
        : { error: "Account created. Confirm the email we sent, then you are in." }),
    });
  }

  try {
    await persistOwnProfile(role);
  } catch {
    /* trigger may already have written the row */
  }

  return Response.json({
    authenticated: true,
    created: true,
    userId: signedIn.data.user.id,
    email: signedIn.data.user.email ?? email,
    role,
  });
}
