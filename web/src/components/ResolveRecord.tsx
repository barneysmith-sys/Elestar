"use client"

import { useEffect, useState } from "react"
import RecordRows from "./RecordRows"
import UnresolvedField from "./UnresolvedField"
import { reduceMotion } from "../lib/motion"

const ORDER = ["Company", "Role", "Round", "Verified"] as const

function OutcomeValue({ live }: { live: boolean }) {
  return (
    <span className="outcome-never">
      <UnresolvedField live={live} label="Not published" />
      <span className="type-caption outcome-cap">NEVER PUBLISHED</span>
    </span>
  )
}

function ReadyRecord() {
  return (
    <div className="resolve-panel">
      <RecordRows
        rows={[
          { label: "Company", value: "Stripe" },
          { label: "Role", value: "Brand designer" },
          { label: "Round", value: "Final" },
          { label: "Verified", value: "Mail proved" },
          { label: "Outcome", state: "unresolved", value: <OutcomeValue live /> },
        ]}
      />
    </div>
  )
}

function PlayRecord() {
  const still = reduceMotion()
  const [done, setDone] = useState<Set<string>>(() => (still ? new Set(ORDER) : new Set()))
  const [resolving, setResolving] = useState<string | null>(still ? null : "Company")

  useEffect(() => {
    if (still) return
    let i = 0
    let t = 0
    const step = () => {
      const label = ORDER[i]
      if (!label) return
      setResolving(label)
      t = window.setTimeout(() => {
        setDone(prev => new Set(prev).add(label))
        setResolving(null)
        i += 1
        if (i < ORDER.length) t = window.setTimeout(step, 220)
      }, 640)
    }
    t = window.setTimeout(step, 280)
    return () => window.clearTimeout(t)
  }, [still])

  const stateFor = (label: string): "resolved" | "resolving" | "unresolved" => {
    if (done.has(label)) return "resolved"
    if (resolving === label) return "resolving"
    return "unresolved"
  }

  const value = (label: typeof ORDER[number], text: string) => {
    const state = stateFor(label)
    if (state === "resolved") return text
    return <UnresolvedField live={state === "resolving"} label="Resolving" />
  }

  return (
    <div className="resolve-panel">
      <RecordRows
        rows={[
          { label: "Company", state: stateFor("Company"), value: value("Company", "Stripe") },
          { label: "Role", state: stateFor("Role"), value: value("Role", "Brand designer") },
          { label: "Round", state: stateFor("Round"), value: value("Round", "Final") },
          { label: "Verified", state: stateFor("Verified"), value: value("Verified", "Mail proved") },
          { label: "Outcome", state: "unresolved", value: <OutcomeValue live /> },
        ]}
      />
    </div>
  )
}

export default function ResolveRecord({
  play = true,
}: {
  play?: boolean
}) {
  if (!play) return <ReadyRecord />
  return <PlayRecord />
}
