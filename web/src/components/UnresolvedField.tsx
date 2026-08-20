"use client"

import { useEffect, useRef } from "react"

type Particle = {
  x: number
  y: number
  ox: number
  oy: number
  vx: number
  vy: number
}

function reduceMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function seedParticles(w: number, h: number) {
  const list: Particle[] = []
  const step = 7
  for (let y = 6; y < h - 6; y += step) {
    for (let x = 6; x < w - 6; x += step) {
      const jitter = (Math.sin(x * 0.17 + y * 0.11) + 1) * 1.4
      list.push({
        x: x + jitter,
        y: y + jitter * 0.4,
        ox: x,
        oy: y,
        vx: Math.sin(x * 0.2) * 0.15,
        vy: Math.cos(y * 0.18) * 0.15,
      })
    }
  }
  return list
}

export default function UnresolvedField({
  live = true,
  label = "Not published",
}: {
  live?: boolean
  label?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const parent = canvas.parentElement
    if (!parent) return

    let particles = seedParticles(parent.clientWidth, 28)
    let raf = 0
    const still = reduceMotion() || !live

    const paint = () => {
      const w = parent.clientWidth
      const h = 28
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = "#152238"
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const tick = () => {
      const w = parent.clientWidth
      for (const p of particles) {
        p.vx += Math.sin(p.oy * 0.08 + p.ox * 0.03 + performance.now() / 700) * 0.02
        p.vy += Math.cos(p.ox * 0.07 + performance.now() / 640) * 0.02
        p.vx *= 0.92
        p.vy *= 0.92
        p.x += p.vx
        p.y += p.vy
        if (p.x < 2) p.x = w - 4
        if (p.x > w - 2) p.x = 4
        if (p.y < 3) p.y = 25
        if (p.y > 25) p.y = 4
      }
      paint()
      raf = window.requestAnimationFrame(tick)
    }

    const ro = new ResizeObserver(() => {
      particles = seedParticles(parent.clientWidth, 28)
      paint()
    })
    ro.observe(parent)
    paint()
    if (!still) raf = window.requestAnimationFrame(tick)
    return () => {
      ro.disconnect()
      window.cancelAnimationFrame(raf)
    }
  }, [live])

  return (
    <span className="unresolved" aria-label={label}>
      <canvas ref={canvasRef} className="unresolved-canvas" />
    </span>
  )
}
