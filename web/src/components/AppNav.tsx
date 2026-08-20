"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "../router";
import Logo from "../brand";

const LINKS = [
  { href: "/wall", label: "Wall" },
  { href: "/circuit", label: "Circuit" },
  { href: "/verify", label: "Verify" },
  { href: "/desk", label: "Desk" },
  { href: "/search", label: "Search" },
  { href: "/signals", label: "Signals" },
  { href: "/intros", label: "Intros" },
  { href: "/system", label: "Lab" },
] as const;

export default function AppNav() {
  const pathname = usePathname() ?? "/";
  const { dark, toggleDark, mode, setMode, signedIn, signOut } = useRouter();

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-[14px]"
      style={{ background: "color-mix(in srgb, var(--background) 88%, transparent)", borderColor: "var(--border)" }}
    >
      <div className="max-w-[1440px] mx-auto px-5 md:px-7 h-[58px] flex items-center gap-4">
        <Link href="/" className="flex-shrink-0" aria-label="Elestar home">
          <Logo size="md" />
        </Link>

        <nav className="flex items-stretch h-full gap-1 ml-2 overflow-x-auto" aria-label="Product">
          {LINKS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(`${t.href}/`) || (t.href === "/system" && pathname.startsWith("/agent-lab"));
            return (
              <Link
                key={t.href}
                href={t.href}
                className="px-3 text-[11px] font-mono uppercase tracking-[0.14em] border-b-2 h-full flex items-center"
                style={{
                  borderBottomColor: active ? "var(--navy)" : "transparent",
                  color: "var(--navy)",
                  opacity: active ? 1 : 0.5,
                }}
                aria-current={active ? "page" : undefined}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="hidden sm:flex border" style={{ borderColor: "var(--navy)" }}>
          {([
            { id: "firm" as const, href: "/search", label: "Hiring" },
            { id: "creative" as const, href: "/verify", label: "Candidate" },
          ]).map((m) => {
            const onDesk = pathname.startsWith("/desk");
            const active = onDesk
              ? mode === m.id
              : m.id === "firm"
                ? pathname.startsWith("/search") || pathname.startsWith("/signals")
                : pathname.startsWith("/verify") || pathname.startsWith("/list");
            return (
              <Link
                key={m.id}
                href={onDesk ? "/desk" : m.href}
                onClick={() => setMode(m.id)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] px-3.5 py-1.5"
                style={{
                  background: active ? "var(--navy)" : "transparent",
                  color: active ? "var(--primary-foreground)" : "var(--navy)",
                }}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={toggleDark}
          className="w-8 h-8 grid place-items-center border"
          style={{ borderColor: "var(--border-2)", color: "var(--navy)" }}
          title={dark ? "Light mode" : "Dark mode"}
        >
          {dark ? (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>

        {signedIn ? (
          <button
            type="button"
            onClick={() => signOut()}
            className="font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 border"
            style={{ color: "var(--navy)", borderColor: "var(--navy)" }}
          >
            Sign out
          </button>
        ) : (
          <Link
            href="/signup"
            className="font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 border"
            style={{ color: "var(--navy)", borderColor: "var(--navy)" }}
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
