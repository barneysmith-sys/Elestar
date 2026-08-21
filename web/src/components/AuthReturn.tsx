"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../../utils/supabase/client";

/**
 * Hash tokens from email confirmation never reach the server. Catch them
 * here so a production Site URL still finishes the session.
 */
export function AuthReturn() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    const supabase = createClient();
    if (!supabase) return;

    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        window.history.replaceState(null, "", pathname);
        if (error || !data.session) {
          router.replace("/signup?mode=signin&reason=confirm-failed");
          return;
        }
        const role = data.session.user.app_metadata?.role ?? data.session.user.user_metadata?.role;
        router.replace(role === "candidate" || role === "creative" ? "/verify" : "/desk");
      });
  }, [pathname, router]);

  return null;
}
