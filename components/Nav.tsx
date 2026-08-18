"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./primitives";

const LINKS = [
  { href: "/list", label: "List a process" },
  { href: "/circuit", label: "Circuit" },
  { href: "/search", label: "Search" },
  { href: "/intros", label: "Intros" },
  { href: "/system", label: "System" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <Link href="/" style={{ color: "inherit", textDecoration: "none" }} aria-label="Elestar home">
        <Wordmark size={17} />
      </Link>

      <div className="nav-links">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
