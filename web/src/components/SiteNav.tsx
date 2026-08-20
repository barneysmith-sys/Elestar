"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Logo from "../brand"
import { useRouter } from "../router"
import DotIcon from "./DotIcon"

const LINKS = [
  { label: "Candidates", href: "/candidates", intent: "creative" as const },
  { label: "Hiring", href: "/hiring", intent: "firm" as const },
]

export default function SiteNav() {
  const { signedIn, setWallView } = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <header className="site-nav">
      <div className="site-nav-bar">
        <Link href="/" className="logo-btn" aria-label="Elestar home" onClick={() => setOpen(false)}>
          <Logo size="sm" />
        </Link>

        <nav className="site-nav-desk" aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="type-nav"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="site-nav-end">
          {signedIn ? (
            <button
              type="button"
              className="type-nav site-nav-account"
              onClick={() => setWallView("desk")}
            >
              Desk
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
            aria-controls="site-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="type-label">{open ? "Close" : "Menu"}</span>
            <DotIcon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>

      {open ? (
        <nav id="site-menu" className="site-nav-mobile" aria-label="Menu">
          <dl className="record">
            {LINKS.map((link) => (
              <div key={link.label} className="record-row">
                <dt className="type-label">Go</dt>
                <dd>
                  <Link
                    href={link.href}
                    className="type-value linkish"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                </dd>
              </div>
            ))}
            <div className="record-row">
              <dt className="type-label">Account</dt>
              <dd>
                {signedIn ? (
                  <button
                    type="button"
                    className="type-value linkish"
                    onClick={() => {
                      setOpen(false)
                      setWallView("desk")
                    }}
                  >
                    Open the desk
                  </button>
                ) : (
                  <Link href="/signup" className="type-value linkish" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                )}
              </dd>
            </div>
          </dl>
        </nav>
      ) : null}
    </header>
  )
}
