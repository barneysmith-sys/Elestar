import { z } from "zod";
import { getCapabilities } from "../../../../lib/capabilities";
import { parseEmail } from "../../../../lib/account";
import { createSupabaseRequestClient } from "../../../../lib/supabaseServer";
import { emailRedirectTo } from "../../../../lib/siteUrl";

export const dynamic = "force-dynamic";

const BodyZ = z.object({
  email: z.string().min(3).max(320),
});

export async function POST(request: Request): Promise<Response> {
  if (!getCapabilities().accounts) {
    return Response.json({ error: "Accounts are not configured." }, { status: 503 });
  }
  const parsed = BodyZ.safeParse(await request.json().catch(() => null));
  const email = parsed.success ? parseEmail(parsed.data.email) : null;
  if (!email) return Response.json({ error: "Enter the email you used to sign up." }, { status: 400 });

  const supabase = await createSupabaseRequestClient();
  if (!supabase) return Response.json({ error: "Auth client is not configured." }, { status: 503 });

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: emailRedirectTo(request) },
  });
  if (error) {
    return Response.json(
      { error: /rate/i.test(error.message) ? "Wait a minute, then request another confirmation email." : "Could not resend the confirmation email." },
      { status: 400 },
    );
  }
  return Response.json({ sent: true, email });
}
