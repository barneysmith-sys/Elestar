"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import { reduceMotion } from "../lib/motion"

export default function Enter({
  className = "",
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(() => reduceMotion())

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const items = [...el.querySelectorAll<HTMLElement>(":scope .enter-item")]
    items.forEach((node, i) => {
      const delay = Math.min(160, i === 0 ? 0 : 110 + (i - 1) * 40)
      node.style.setProperty("--enter-d", `${delay}ms`)
    })
  }, [])

  useEffect(() => {
    if (reduceMotion()) {
      setOn(true)
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setOn(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -12% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`enter${on ? " is-in" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  )
}
