import "server-only";
import { getSupabaseAdmin, hasSupabaseAdmin } from "./supabaseAdmin";
import { parseAccountRole, type AccountRole } from "./account";
import { createSupabaseRequestClient } from "./supabaseServer";

export async function provisionAccount(userId: string, role: AccountRole): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (metaError) throw new Error(metaError.message);

  const { error: profileError } = await admin.from("profiles").upsert(
    { user_id: userId, role },
    { onConflict: "user_id" },
  );
  if (profileError) throw new Error(profileError.message);

  if (role === "employer") {
    const { error: recruiterError } = await admin.from("recruiters").upsert(
      { user_id: userId },
      { onConflict: "user_id" },
    );
    if (recruiterError) throw new Error(recruiterError.message);
  }
}

export async function readAccountRole(userId: string): Promise<AccountRole | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.role === "candidate" || data?.role === "employer" ? data.role : null;
}

export async function readOwnAccountRole(): Promise<AccountRole | null> {
  const supabase = await createSupabaseRequestClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("role").maybeSingle();
  if (error) return null;
  return data?.role === "candidate" || data?.role === "employer" ? data.role : null;
}

/** After cookie sign-in, persist role without the service role key. */
export async function persistOwnProfile(role: AccountRole): Promise<void> {
  const supabase = await createSupabaseRequestClient();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const existing = await readOwnAccountRole();
  if (existing) return;

  const { error: profileError } = await supabase.from("profiles").insert({ user_id: user.id, role });
  if (profileError && !/duplicate|unique/i.test(profileError.message)) {
    throw new Error(profileError.message);
  }
  if (role === "employer") {
    const { error: recruiterError } = await supabase.from("recruiters").insert({ user_id: user.id });
    if (recruiterError && !/duplicate|unique/i.test(recruiterError.message)) {
      throw new Error(recruiterError.message);
    }
  }
}

/**
 * Repair a real Auth user that has no profile row yet (dashboard-created
 * accounts, or a signup that created the user then failed the write).
 * Role comes from app_metadata first — never user_metadata.
 */
export async function ensureAccount(userId: string, fallback?: AccountRole | null): Promise<AccountRole | null> {
  if (!hasSupabaseAdmin()) {
    return (await readOwnAccountRole()) ?? fallback ?? null;
  }

  const existing = await readAccountRole(userId);
  if (existing) return existing;

  const admin = getSupabaseAdmin();
  const { data } = await admin.auth.admin.getUserById(userId);
  const fromMeta = parseAccountRole(data.user?.app_metadata?.role);
  const role = fromMeta ?? fallback ?? null;
  if (!role) return null;
  await provisionAccount(userId, role);
  return role;
}
