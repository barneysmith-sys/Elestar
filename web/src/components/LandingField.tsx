"use client"

import { useEffect, useState } from "react"
import eye from "../assets/eye.png"
import portrait from "../assets/hero-portrait.png"

export default function LandingField() {
  const [stage, setStage] = useState<"hero" | "page">("hero")

  useEffect(() => {
    const hero = document.getElementById("enter")
    if (!hero) return
    const io = new IntersectionObserver((entries) => {
      setStage(entries[0]?.isIntersecting ? "hero" : "page")
    }, { threshold: 0.48 })
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  return (
    <div className="land-field" data-stage={stage} aria-hidden="true">
      <img className="land-eye" src={eye} alt="" decoding="async" />
      <img className="land-eye land-eye-scan" src={eye} alt="" decoding="async" />
      <img className="land-face" src={portrait} alt="" decoding="async" />
      <img className="land-face eye-lit" src={portrait} alt="" decoding="async" />
    </div>
  )
}
