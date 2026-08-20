"use client"

export default function EyeFade({
  tone = "site",
}: {
  tone?: "site" | "hero"
}) {
  const src = tone === "hero" ? "/hero-portrait.png" : "/eye.png"
  return (
    <div className={`eye-field eye-field-${tone}`} aria-hidden="true">
      <img src={src} alt="" decoding="async" />
      {tone === "hero" && <img className="eye-lit" src={src} alt="" decoding="async" />}
    </div>
  )
}
