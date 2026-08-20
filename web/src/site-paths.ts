export type SitePage =
  | "landing"
  | "candidates"
  | "hiring"
  | "signup"
  | "board"
  | "profile"
  | "onboard"
  | "verification"
  | "privacy"
  | "terms"
  | "security"
  | "faq"
  | "pricing"
  | "about"
  | "contact"
  | "careers"
  | "nda"
  | "remove"
  | "publish"
  | "access"
  | "walkthrough"
  | "manifesto"
  | "notfound"

export const PAGE_HREF: Record<SitePage, string> = {
  landing: "/",
  candidates: "/candidates",
  hiring: "/hiring",
  signup: "/signup",
  board: "/wall",
  profile: "/wall",
  onboard: "/signup",
  verification: "/verification",
  privacy: "/privacy",
  terms: "/terms",
  security: "/security",
  faq: "/faq",
  pricing: "/pricing",
  about: "/about",
  contact: "/contact",
  careers: "/careers",
  nda: "/nda",
  remove: "/remove-a-record",
  publish: "/what-we-publish",
  access: "/access",
  walkthrough: "/book-walkthrough",
  manifesto: "/manifesto",
  notfound: "/404",
}

const ALIAS: Record<string, SitePage> = {
  "/how-verification-works": "verification",
}

export const INFO_SLUGS = new Set([
  "verification",
  "privacy",
  "terms",
  "security",
  "faq",
  "pricing",
  "about",
  "contact",
  "careers",
  "nda",
  "remove-a-record",
  "what-we-publish",
  "access",
  "book-walkthrough",
  "how-verification-works",
])

export function hrefFor(page: SitePage, hash?: string) {
  const path = PAGE_HREF[page]
  return hash ? `${path}#${hash}` : path
}

export function pageFromPathname(pathname: string): SitePage {
  const clean = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/"
  if (ALIAS[clean]) return ALIAS[clean]
  const hit = (Object.entries(PAGE_HREF) as [SitePage, string][]).find(([, href]) => {
    const n = href.replace(/\/+$/, "") || "/"
    return n === clean
  })
  if (hit) return hit[0]
  if (clean === "/" || clean === "") return "landing"
  if (
    clean.startsWith("/wall") ||
    clean.startsWith("/circuit") ||
    clean.startsWith("/desk") ||
    clean.startsWith("/search") ||
    clean.startsWith("/verify") ||
    clean.startsWith("/signals") ||
    clean.startsWith("/intros") ||
    clean.startsWith("/system")
  ) {
    return "board"
  }
  return "notfound"
}
