"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { hrefFor, type SitePage } from "../site-paths"

const COLS: { title: string; links: { label: string; page: SitePage; hash?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How verification works", page: "verification" },
      { label: "The Wall", page: "landing", hash: "wall" },
      { label: "Manifesto", page: "manifesto" },
      { label: "Pricing", page: "pricing" },
    ],
  },
  {
    title: "Candidates",
    links: [
      { label: "Prove a round", page: "candidates" },
      { label: "What we publish", page: "publish" },
      { label: "Remove a record", page: "remove" },
    ],
  },
  {
    title: "Employers",
    links: [
      { label: "Skip a round", page: "hiring" },
      { label: "Access", page: "access" },
      { label: "Book a walkthrough", page: "walkthrough" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", page: "about" },
      { label: "Contact", page: "contact" },
      { label: "Careers", page: "careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", page: "privacy" },
      { label: "Terms", page: "terms" },
      { label: "Security", page: "security" },
      { label: "NDA policy", page: "nda" },
    ],
  },
]

function FootLink({
  page,
  hash,
  children,
}: {
  page: SitePage
  hash?: string
  children: ReactNode
}) {
  return (
    <Link className="type-value linkish" href={hrefFor(page, hash)}>
      {children}
    </Link>
  )
}

export default function SiteFooter() {
  return (
    <footer className="site-footer" id="site-footer">
      <div className="foot-grid">
        {COLS.map((col) => (
          <div key={col.title} className="foot-col">
            <p className="type-label">{col.title}</p>
            <ul>
              {col.links.map((link) => (
                <li key={link.label}>
                  <FootLink page={link.page} hash={link.hash}>
                    {link.label}
                  </FootLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="foot-bar">
        <span className="type-caption">Elestar</span>
        <span className="type-caption">© 2026</span>
        <span className="type-caption">Company and round. Never the outcome.</span>
      </div>
    </footer>
  )
}
