"use client"

import { useEffect, useState } from "react"
import RecordRows from "./RecordRows"
import UnresolvedField from "./UnresolvedField"
import { reduceMotion } from "../lib/motion"

const ROWS = [
  { label: "Outcome", ink: "The result" },
  { label: "Questions", ink: "The questions" },
  { label: "Take-home", ink: "The assignment" },
  { label: "Why they left", ink: "The reason" },
  { label: "Your inbox", ink: "The original mail" },
] as const

function Row({
  ink,
  gone,
  delay,
}: {
  ink: string
  gone: boolean
  delay: number
}) {
  const still = reduceMotion()
  return (
    <span
      className={`unresolve${gone || still ? " is-gone" : ""}`}
      style={{ transitionDelay: still ? "0ms" : `${delay}ms` }}
    >
      <span className="unresolve-ink type-value">{ink}</span>
      <span className="unresolve-dots">
        <UnresolvedField live={!still} label="Not published" />
      </span>
    </span>
  )
}

export default function RefusalRows() {
  const still = reduceMotion()
  const [gone, setGone] = useState(still)

  useEffect(() => {
    if (still) return
    const root = document.getElementById("refusal")
    if (!root) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setGone(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -12% 0px" },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [still])

  return (
    <RecordRows
      rows={ROWS.map((row, i) => ({
        label: row.label,
        state: gone || still ? "unresolved" : "resolved",
        value: <Row ink={row.ink} gone={gone} delay={i * 90} />,
      }))}
    />
  )
}
