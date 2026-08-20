"use client"

const HEIGHT = { sm: 28, md: 32, lg: 40 } as const

export default function Logo({
  size = "md",
  invert = false,
}: {
  size?: "sm" | "md" | "lg"
  invert?: boolean
}) {
  const h = HEIGHT[size]
  return (
    <span className={`logo logo-${size}`} style={{ height: h }}>
      <img
        src="/elestar-logo.svg"
        alt="Elestar"
        className={`logo-mark${invert ? " logo-mark-on-dark" : ""}`}
        height={h}
      />
    </span>
  )
}
