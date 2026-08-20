"use client"

import { useId } from "react"
import { ROUND_DENSITY, ROUND_LABEL, type RoundKind } from "../lib/rounds"

const STAR =
  "M12 2C12 7.2 7.2 12 2 12C7.2 12 12 16.8 12 22C12 16.8 16.8 12 22 12C16.8 12 12 7.2 12 2Z"

export default function DepthGlyph({
  kind,
  className = "",
}: {
  kind: RoundKind
  className?: string
}) {
  const density = ROUND_DENSITY[kind]
  const uid = `d${useId().replace(/:/g, "")}`
  const solid = density >= 1

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <defs>
        <pattern id={`${uid}-pat`} width="2.2" height="2.2" patternUnits="userSpaceOnUse">
          <circle cx="1.1" cy="1.1" r="0.52" fill="currentColor" />
        </pattern>
        <mask id={`${uid}-mask`}>
          <path d={STAR} fill="white" />
        </mask>
      </defs>
      <g mask={`url(#${uid}-mask)`}>
        {solid ? (
          <rect width="24" height="24" fill="currentColor" />
        ) : (
          <rect width="24" height="24" fill={`url(#${uid}-pat)`} opacity={Math.max(0.22, density)} />
        )}
      </g>
      <title>{ROUND_LABEL[kind]}</title>
    </svg>
  )
}
