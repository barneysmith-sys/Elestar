"use client"

import eye from "../assets/eye.png"
import portrait from "../assets/hero-portrait.png"

export default function EyeFade({
  tone = "site",
}: {
  tone?: "site" | "hero"
}) {
  const src = tone === "hero" ? portrait : eye
  return (
    <div className={`eye-field eye-field-${tone}`} aria-hidden="true">
      <img src={src} alt="" decoding="async" />
      {tone === "hero" && <img className="eye-lit" src={src} alt="" decoding="async" />}
    </div>
  )
}
