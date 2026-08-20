"use client"

import SiteShell from "../web/src/components/SiteShell"

export default function NotFound() {
  return (
    <SiteShell title="Not found · Elestar">
      <section className="hero hero-solo">
        <div className="hero-copy">
          <h1 className="type-hero">That page is not here.</h1>
          <p className="type-lede">The URL does not match a page Elestar ships.</p>
          <div className="cta-row">
            <a className="btn" href="/">
              Back to Elestar
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
