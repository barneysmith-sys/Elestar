"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "../brand";
import { useRouter } from "../router";
import DotIcon from "./DotIcon";

const LINKS = [
  { href: "/verify", label: "Verify" },
  { href: "/wall", label: "Wall" },
  { href: "/circuit", label: "Circuit" },
  { href: "/desk", label: "Desk" },
  { href: "/search", label: "Search" },
  { href: "/signals", label: "Signals" },
  { href: "/intros", label: "Intros" },
  { href: "/agent-lab", label: "Agent lab" },
];

export default function AppNav() {
  const pathname = usePathname() ?? "/";
  const { signedIn, signOut } = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-nav">
      <div className="site-nav-bar">
        <Link href="/" className="logo-btn" aria-label="Elestar home" onClick={() => setOpen(false)}>
          <Logo size="sm" />
        </Link>
        <nav className="site-nav-desk" aria-label="Product" style={{ overflowX: "auto", flex: 1 }}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="type-nav"
              data-active={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="site-nav-end">
          {signedIn ? (
            <button type="button" className="type-nav site-nav-account" onClick={() => signOut()}>
              Sign out
            </button>
          ) : (
            <Link href="/signup" className="type-nav site-nav-account">
              Sign in
            </Link>
          )}
          <button
            type="button"
            className="site-nav-menu"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="product-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="type-label">{open ? "Close" : "MENU"}</span>
            <DotIcon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open ? (
        <nav id="product-menu" className="site-nav-mobile" aria-label="Product menu">
          <dl className="record">
            {LINKS.map((link) => (
              <div key={link.href} className="record-row">
                <dt className="type-label">Go</dt>
                <dd>
                  <Link href={link.href} className="type-value linkish" onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </nav>
      ) : null}
    </header>
  );
}
