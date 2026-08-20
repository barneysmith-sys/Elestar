"use client"

import { type ReactNode, useEffect } from "react"
import { useRouter } from "../router"
import EyeField from "./EyeField"
import SiteFooter from "./SiteFooter"
import SiteNav from "./SiteNav"

export default function SiteShell({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  const { page } = useRouter()

  useEffect(() => {
    if (!title) return
    document.title = title
  }, [title])

  return (
    <div className="site" data-page={page}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {page === "landing" ? <EyeField /> : null}
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  )
}
