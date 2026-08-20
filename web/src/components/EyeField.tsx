"use client"

import { useEffect, useState } from "react"
import { reduceMotion } from "../lib/motion"

const STOPS: { id: string; opacity: number }[] = [
  { id: "enter", opacity: 0.07 },
  { id: "cost", opacity: 0.08 },
  { id: "mechanic", opacity: 0.055 },
  { id: "wall", opacity: 0.05 },
  { id: "belongs", opacity: 0.09 },
  { id: "refusal", opacity: 0.05 },
  { id: "fork", opacity: 0.055 },
  { id: "site-footer", opacity: 0.05 },
]

const REST = 0.055

function smooth(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function scrollTarget() {
  const y = window.scrollY + window.innerHeight * 0.42
  const pts = STOPS.map(s => {
    const el = document.getElementById(s.id)
    if (!el) return null
    const top = el.getBoundingClientRect().top + window.scrollY
    return { y: top, opacity: s.opacity }
  }).filter((p): p is { y: number; opacity: number } => p != null)
  if (!pts.length) return REST
  pts.sort((a, b) => a.y - b.y)
  const first = pts[0]!
  if (y <= first.y) return first.opacity
  const last = pts[pts.length - 1]!
  if (y >= last.y) return last.opacity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / Math.max(1, b.y - a.y)
      return a.opacity + (b.opacity - a.opacity) * smooth(t)
    }
  }
  return REST
}

export default function EyeField() {
  const [amt, setAmt] = useState(REST)

  useEffect(() => {
    if (reduceMotion()) {
      setAmt(REST)
      return
    }
    const onMove = () => setAmt(scrollTarget())
    onMove()
    window.addEventListener("scroll", onMove, { passive: true })
    window.addEventListener("resize", onMove)
    return () => {
      window.removeEventListener("scroll", onMove)
      window.removeEventListener("resize", onMove)
    }
  }, [])

  return (
    <div className="xerox-field" aria-hidden="true">
      <img src="/eye-xerox.png" alt="" width={900} height={900} style={{ opacity: amt }} />
    </div>
  )
}
