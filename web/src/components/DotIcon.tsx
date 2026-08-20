"use client"

import { useId } from "react"

type IconName = "menu" | "close" | "mail" | "check"

const DOTS: Record<IconName, { x: number; y: number; r: 0 | 1 | 2 }[]> = {
  menu: [
    { x: 6, y: 7, r: 1 }, { x: 12, y: 7, r: 1 }, { x: 18, y: 7, r: 1 },
    { x: 6, y: 12, r: 1 }, { x: 12, y: 12, r: 1 }, { x: 18, y: 12, r: 1 },
    { x: 6, y: 17, r: 1 }, { x: 12, y: 17, r: 1 }, { x: 18, y: 17, r: 1 },
  ],
  close: [
    { x: 7, y: 7, r: 1 }, { x: 17, y: 7, r: 1 },
    { x: 9.5, y: 9.5, r: 0 }, { x: 14.5, y: 9.5, r: 0 },
    { x: 12, y: 12, r: 2 },
    { x: 9.5, y: 14.5, r: 0 }, { x: 14.5, y: 14.5, r: 0 },
    { x: 7, y: 17, r: 1 }, { x: 17, y: 17, r: 1 },
  ],
  mail: [
    { x: 6, y: 8, r: 1 }, { x: 12, y: 8, r: 1 }, { x: 18, y: 8, r: 1 },
    { x: 6, y: 12, r: 0 }, { x: 9, y: 10.5, r: 0 }, { x: 12, y: 12.5, r: 1 }, { x: 15, y: 10.5, r: 0 }, { x: 18, y: 12, r: 0 },
    { x: 6, y: 16, r: 1 }, { x: 12, y: 16, r: 1 }, { x: 18, y: 16, r: 1 },
  ],
  check: [
    { x: 6, y: 12, r: 0 },
    { x: 8.5, y: 14.5, r: 1 },
    { x: 11, y: 16.5, r: 2 },
    { x: 14, y: 13, r: 1 },
    { x: 16.5, y: 10, r: 1 },
    { x: 18.5, y: 8, r: 0 },
  ],
}

const R = [0.9, 1.35, 1.9]

export default function DotIcon({
  name,
  className = "",
  title,
}: {
  name: IconName
  className?: string
  title?: string
}) {
  const uid = useId().replace(/:/g, "")
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <circle id={`${uid}-0`} r={R[0]} fill="currentColor" />
        <circle id={`${uid}-1`} r={R[1]} fill="currentColor" />
        <circle id={`${uid}-2`} r={R[2]} fill="currentColor" />
      </defs>
      {DOTS[name].map((d, i) => (
        <use key={i} href={`#${uid}-${d.r}`} x={d.x} y={d.y} />
      ))}
    </svg>
  )
}
