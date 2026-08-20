import { createSupabaseRequestClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const supabase = await createSupabaseRequestClient();
  if (supabase) await supabase.auth.signOut();
  return Response.json({ authenticated: false });
}
