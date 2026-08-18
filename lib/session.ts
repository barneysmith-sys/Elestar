import "server-only";
import { cookies } from "next/headers";
import { getAuthenticatedUserId } from "./supabaseServer";
import { getCapabilities } from "./capabilities";

/**
 * Who the caller is.
 *
 * With Supabase configured this is a real authenticated user id and RLS
 * applies to everything they can see. Without it, the product still has to be
 * usable — a YC partner opening the app should not hit a login wall — so a
 * per-browser demo identity is issued instead.
 *
 * The demo identity is deliberately not a pretend login: it grants no
 * privileges, it is scoped to the in-memory store, and `authenticated` is
 * false so surfaces can say which mode they are in.
 */

const DEMO_COOKIE = "elestar_demo_session";

export interface Session {
  userId: string;
  authenticated: boolean;
  /**
   * The recruiter identity used for intro requests. In a real deployment these
   * are two different people; in a demo one person plays both sides, and the
   * UI labels that rather than hiding it.
   */
  recruiterId: string;
}

export async function getSession(): Promise<Session> {
  if (getCapabilities().persistence) {
    const userId = await getAuthenticatedUserId();
    if (userId) {
      return { userId, authenticated: true, recruiterId: userId };
    }
  }

  const jar = await cookies();
  const existing = jar.get(DEMO_COOKIE)?.value;
  const userId = existing && /^demo-[a-z0-9]{8,}$/.test(existing) ? existing : newDemoId();

  return { userId, authenticated: false, recruiterId: `${userId}-recruiter` };
}

/**
 * Route handlers can set cookies on their own Response; Server Components
 * cannot. Callers that are able to persist the session id do so with this.
 */
export function demoSessionCookie(userId: string): {
  name: string;
  value: string;
  options: { httpOnly: true; sameSite: "lax"; path: string; maxAge: number };
} {
  return {
    name: DEMO_COOKIE,
    value: userId,
    options: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 },
  };
}

function newDemoId(): string {
  return `demo-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Whether this session may decide a given intro request.
 *
 * With real auth, only the candidate who owns the dossier can. In demo mode
 * one person has to be able to run the whole loop — request an intro and then
 * approve it — so the demo session is allowed to act as the candidate side of
 * any demo record. This is the one place demo mode is more permissive than
 * production, and it is confined to records that are already anonymous.
 */
export function canDecideIntro(session: Session, candidateId: string): boolean {
  if (session.authenticated) return session.userId === candidateId;
  return true;
}
