"use client"

import wordmark from "./assets/elestarr-wordmark.png"

export default function Logo({
  size = "md",
  invert = false,
}: {
  size?: "sm" | "md" | "lg"
  invert?: boolean
}) {
  const h = size === "lg" ? 48 : size === "sm" ? 26 : 38

  return (
    <span className="inline-flex items-center">
      <img
        src={wordmark}
        alt="Elestar"
        className={`logo-mark flex-none ${invert ? "logo-mark-on-dark" : ""}`}
        style={{ height: h, width: "auto" }}
      />
    </span>
  )
}
