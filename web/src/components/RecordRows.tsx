"use client"

import type { ReactNode } from "react"

export type RecordRow = {
  label: string
  value?: ReactNode
  state?: "resolved" | "resolving" | "unresolved"
}

export default function RecordRows({
  rows,
  className = "",
}: {
  rows: RecordRow[]
  className?: string
}) {
  return (
    <dl className={`record ${className}`.trim()}>
      {rows.map(row => (
        <div key={row.label} className="record-row" data-state={row.state ?? "resolved"}>
          <dt className="type-label">{row.label}</dt>
          <dd className="type-value">
            {row.state === "unresolved" && row.value == null ? (
              <span className="unresolved" aria-label="Not published">
                <span className="unresolved-dots" aria-hidden="true" />
              </span>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
