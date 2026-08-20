"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter as useNextRouter } from "next/navigation";
import { fetchAuth, signOutAccount, type AuthSession } from "./elestar-api";
import { hrefFor, pageFromPathname, type SitePage } from "./site-paths";

export type Page = SitePage;
export type Role = "firm" | "creative";
export type Mode = Role;
export type WallView = "wall" | "pipeline" | "desk" | "listings";

type RouterCtx = {
  page: Page;
  navigate: (p: Page, id?: number, workIndex?: number) => void;
  profileId: number;
  workIndex: number;
  dark: boolean;
  toggleDark: () => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  role: Role;
  wallView: WallView;
  setWallView: (v: WallView) => void;
  refsLeft: number;
  vouched: Set<number>;
  spendReferral: (id: number) => boolean;
  contact: (name: string) => void;
  stages: Record<number, string>;
  setStage: (id: number, stage: string) => void;
  toast: string | null;
  showToast: (html: string) => void;
  signedIn: boolean;
  email: string | null;
  applySession: (session: AuthSession) => void;
  signIn: (role: Role) => void;
  signOut: () => void;
  intent: Role;
  setIntent: (r: Role) => void;
  onboarded: boolean;
  finishOnboard: (next?: WallView) => void;
};

const Ctx = createContext<RouterCtx | null>(null);

export function useRouter(): RouterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}

function pageFromPath(pathname: string): Page {
  return pageFromPathname(pathname);
}

function wallFromPath(pathname: string): WallView {
  if (pathname.startsWith("/desk") || pathname.startsWith("/search")) return "desk";
  if (pathname.startsWith("/verify")) return "listings";
  return "wall";
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const nextRouter = useNextRouter();
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("firm");
  const [intent, setIntent] = useState<Role>("firm");
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    fetchAuth()
      .then((session) => {
        setSignedIn(Boolean(session.authenticated));
        setEmail(session.email ?? null);
        if (session.role === "candidate") setMode("creative");
        if (session.role === "employer") setMode("firm");
      })
      .catch(() => {
        setSignedIn(false);
        setEmail(null);
      });
  }, []);

  const showToast = useCallback((html: string) => {
    setToast(html);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const navigate = useCallback(
    (p: Page) => {
      nextRouter.push(hrefFor(p));
    },
    [nextRouter],
  );

  const value: RouterCtx = {
    page: pageFromPath(pathname),
    navigate,
    profileId: 0,
    workIndex: 0,
    dark,
    toggleDark: () => setDark((d) => !d),
    mode,
    setMode,
    role: mode,
    wallView: wallFromPath(pathname),
    setWallView: (v) => {
      if (v === "desk") nextRouter.push("/desk");
      else if (v === "listings") nextRouter.push("/verify");
      else nextRouter.push("/wall");
    },
    refsLeft: 0,
    vouched: new Set(),
    spendReferral: () => false,
    contact: () => showToast("Intro requested. Nothing is revealed until they approve."),
    stages: {},
    setStage: () => undefined,
    toast,
    showToast,
    signedIn,
    email,
    applySession: (session) => {
      setSignedIn(Boolean(session.authenticated));
      setEmail(session.email ?? null);
      if (!session.authenticated) return;
      const nextRole: Role =
        session.role === "candidate" ? "creative" : session.role === "employer" ? "firm" : intent;
      setMode(nextRole);
      nextRouter.push(nextRole === "creative" ? "/verify" : "/search");
    },
    signIn: (role) => {
      setMode(role);
      setIntent(role);
      nextRouter.push(`/signup?intent=${role}`);
    },
    signOut: () => {
      void signOutAccount().finally(() => {
        setSignedIn(false);
        setEmail(null);
        nextRouter.push("/");
      });
    },
    intent,
    setIntent,
    onboarded: true,
    finishOnboard: () => nextRouter.push("/wall"),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
