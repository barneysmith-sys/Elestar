"use client"

import { useEffect, useRef } from "react"
import { LOGO_DOTS, LOGO_MARK_BOX } from "../lib/logoDots"

function reduceMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export default function ResolveCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const parent = canvas.parentElement
    if (!parent) return
    const still = reduceMotion()
    const start = performance.now()
    let raf = 0

    const draw = (now: number) => {
      const w = parent.clientWidth
      const h = Math.min(176, Math.max(118, Math.round(w * 0.4)))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const scale = Math.min(w / LOGO_MARK_BOX.w, h / LOGO_MARK_BOX.h)
      const ox = (w - LOGO_MARK_BOX.w * scale) / 2
      const oy = (h - LOGO_MARK_BOX.h * scale) / 2
      const t = still ? 1 : Math.min(1, (now - start) / 1600)
      const ease = 1 - Math.pow(1 - t, 3)

      ctx.fillStyle = "#152238"
      for (const d of LOGO_DOTS) {
        const jx = (1 - ease) * Math.sin(d.x * 1.7 + d.y) * 10
        const jy = (1 - ease) * Math.cos(d.y * 1.3 + d.x) * 6
        ctx.beginPath()
        ctx.arc(ox + (d.x - LOGO_MARK_BOX.x) * scale + jx, oy + (d.y - LOGO_MARK_BOX.y) * scale + jy, d.r * scale, 0, Math.PI * 2)
        ctx.globalAlpha = 0.25 + ease * 0.75
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!still && t < 1) raf = window.requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(() => draw(performance.now()))
    ro.observe(parent)
    raf = window.requestAnimationFrame(draw)
    return () => {
      ro.disconnect()
      window.cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={ref} className="resolve-canvas" aria-hidden="true" />
}
