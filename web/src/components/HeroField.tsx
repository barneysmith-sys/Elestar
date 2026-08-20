"use client"

import { useEffect, useRef } from "react"

const INK = { r: 21, g: 34, b: 56 }

// Lattice. One cell = one unrecorded round. Density from dropping dots, not moving them.
const Y_PITCH = 2.1
const X_PITCH = 4.2
const MIN_PITCH = 1.55
const CELL_CAP_WIDE = 48000
const CELL_CAP_NARROW = 22000
const RADII = [0.92, 0.58, 0.32]
const ALPHAS = [0.85, 0.58, 0.34]
const RADIUS_CAP = 0.4
const COVER_NOISE = 0.28
const COVER_SNAP = 0.52
const OFFSET_X = 0.55
const OFFSET_Y = 0.34
const INNER_CORE = 0.7
const HALO_SPAN = 2.2
const SNAP_MS = 300
const SNAP_DONE_MS = 1100
const SETTLE_MS = 2200

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

function pitches(w: number, h: number) {
  const cap = w < 480 ? CELL_CAP_NARROW : CELL_CAP_WIDE
  let y = Math.max(MIN_PITCH, Y_PITCH)
  let x = y * (X_PITCH / Y_PITCH)
  const cells = Math.ceil(w / x) * Math.ceil(h / y)
  if (cells > cap) {
    const s = Math.sqrt(cells / cap)
    y = Math.max(MIN_PITCH, y * s)
    x = y * (X_PITCH / Y_PITCH)
  }
  return { x, y }
}

function bayer(col: number, row: number) {
  return (BAYER[row & 7]![col & 7]! + 0.5) / 64
}

const FILM_AR = 1200 / 772

function mediaBox(el: Element | null, host: DOMRect, w: number, h: number) {
  if (!el) {
    return { cx: w / 2, cy: h / 2, filmRx: w * 0.21, filmRy: h * 0.14 }
  }
  const r = el.getBoundingClientRect()
  const boxAr = r.width / Math.max(1, r.height)
  let width = r.width
  let height = r.height
  let left = r.left
  let top = r.top
  if (boxAr > FILM_AR) {
    width = r.height * FILM_AR
    left = r.left + (r.width - width) / 2
  } else {
    height = r.width / FILM_AR
    top = r.top + (r.height - height) / 2
  }
  return {
    cx: left - host.left + width / 2,
    cy: top - host.top + height / 2,
    filmRx: Math.max(8, width / 2),
    filmRy: Math.max(8, height / 2),
  }
}

export default function HeroField({ still }: { still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return
    const host = canvas.parentElement
    if (!host) return

    const start = performance.now()
    let raf = 0
    let tickCount = 0

    const paint = (now: number) => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w < 2 || h < 2) return

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const bw = Math.max(1, Math.floor(w * dpr))
      const bh = Math.max(1, Math.floor(h * dpr))
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const { x: xPitch, y: yPitch } = pitches(w, h)
      const cap = RADIUS_CAP * yPitch
      const cols = Math.ceil(w / xPitch)
      const rows = Math.ceil(h / yPitch)

      const film = host.querySelector(".mark-film")
      const hr = host.getBoundingClientRect()
      const box = mediaBox(film, hr, w, h)
      const { cx, cy, filmRx, filmRy } = box
      const elapsed = still ? SETTLE_MS : now - start
      const grow =
        elapsed < SNAP_MS ? 0 : Math.min(1, (elapsed - SNAP_MS) / (SNAP_DONE_MS - SNAP_MS))
      const snapped = grow > 0.35

      const paths = [new Path2D(), new Path2D(), new Path2D()]
      const radii = RADII.map(r => Math.min(r, cap))

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = (col + 0.5) * xPitch
          const y = (row + 0.5) * yPitch
          const filmDist = Math.sqrt(((x - cx) / filmRx) ** 2 + ((y - cy) / filmRy) ** 2)
          if (filmDist < INNER_CORE) continue

          const far = Math.min(1, Math.max(0, (filmDist - INNER_CORE) / HALO_SPAN))
          const proximity = 1 - far
          const cover = COVER_NOISE + (COVER_SNAP - COVER_NOISE) * proximity * (0.35 + 0.65 * grow)
          if (bayer(col, row) >= cover) continue

          const band = (col * 5 + row * 3) % 3
          const radius = radii[band]!
          const path = paths[band]!
          const jx = snapped ? 0 : Math.sin(col * 12.9898 + row * 78.233) * OFFSET_X
          const jy = snapped ? 0 : Math.cos(col * 39.346 + row * 11.17) * OFFSET_Y
          const px = x + jx
          const py = y + jy
          path.moveTo(px + radius, py)
          path.arc(px, py, radius, 0, Math.PI * 2)
        }
      }

      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(${INK.r},${INK.g},${INK.b},${ALPHAS[i]})`
        ctx.fill(paths[i]!)
      }
    }

    const tick = (now: number) => {
      const elapsed = now - start
      const last = elapsed >= SETTLE_MS
      if (last || (tickCount++ & 1) === 0) paint(now)
      if (!still && !last) raf = window.requestAnimationFrame(tick)
    }

    const ro = new ResizeObserver(() => {
      paint(still ? start + SETTLE_MS : performance.now())
    })
    ro.observe(host)
    const filmEl = host.querySelector(".mark-film")
    const frameEl = host.querySelector(".hero-film-frame")
    if (filmEl) ro.observe(filmEl)
    if (frameEl) ro.observe(frameEl)

    if (still) paint(start + SETTLE_MS)
    else raf = window.requestAnimationFrame(tick)

    return () => {
      ro.disconnect()
      window.cancelAnimationFrame(raf)
    }
  }, [still])

  return <canvas ref={ref} className="hero-field" aria-hidden="true" />
}
