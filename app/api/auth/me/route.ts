import { getCapabilities } from "../../../../lib/capabilities";
import { parseAccountRole, type AccountRole } from "../../../../lib/account";
import { ensureAccount } from "../../../../lib/accountStore";
import { createSupabaseRequestClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const accounts = getCapabilities().accounts;
  const supabase = await createSupabaseRequestClient();
  if (!supabase) {
    return Response.json({ authenticated: false, accounts });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ authenticated: false, accounts });
  }

  let role: AccountRole | null = parseAccountRole(user.app_metadata?.role);
  if (accounts) {
    try {
      role = (await ensureAccount(user.id, role)) ?? role;
    } catch {
      /* profile table may not be applied yet; Auth still holds the session */
    }
  }

  return Response.json({
    authenticated: true,
    accounts,
    userId: user.id,
    email: user.email ?? null,
    role,
  });
}
