"use client"

import { useEffect, useState } from "react"
import UnresolvedField from "./UnresolvedField"
import { reduceMotion } from "../lib/motion"

const LINES = [
  { id: "spf", text: "spf=pass", verify: false },
  { id: "dmarc", text: "dmarc=pass", verify: false },
  { id: "dkim", text: "dkim=pass", verify: true },
] as const

export default function DkimExhibit() {
  const still = reduceMotion()
  const [done, setDone] = useState<Set<string>>(() => (still ? new Set(LINES.map(l => l.id)) : new Set()))
  const [resolving, setResolving] = useState<string | null>(still ? null : null)
  const [play, setPlay] = useState(still)

  useEffect(() => {
    if (still) return
    const root = document.getElementById("mechanic")
    if (!root) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPlay(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -12% 0px" },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [still])

  useEffect(() => {
    if (!play || still) return
    let i = 0
    let t = 0
    const step = () => {
      const line = LINES[i]
      if (!line) return
      setResolving(line.id)
      t = window.setTimeout(() => {
        setDone(prev => new Set(prev).add(line.id))
        setResolving(null)
        i += 1
        if (i < LINES.length) t = window.setTimeout(step, 180)
      }, 640)
    }
    t = window.setTimeout(step, 120)
    return () => window.clearTimeout(t)
  }, [play, still])

  return (
    <div className="dkim-panel">
      <pre className="dkim-head">{`Authentication-Results: elestar.io;`}</pre>
      <ul className="dkim-lines">
        {LINES.map(line => {
          const ready = done.has(line.id)
          const live = resolving === line.id
          return (
            <li key={line.id} className={line.verify && ready ? "dkim-pass" : undefined}>
              {ready ? (
                line.text
              ) : (
                <UnresolvedField live={live} label="Resolving" />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
