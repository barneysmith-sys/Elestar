import "server-only";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { parseAccountRole, type AccountRole } from "./account";

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

/**
 * Repair a real Auth user that has no profile row yet (dashboard-created
 * accounts, or a signup that created the user then failed the write).
 * Role comes from app_metadata first — never user_metadata.
 */
export async function ensureAccount(userId: string, fallback?: AccountRole | null): Promise<AccountRole | null> {
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
