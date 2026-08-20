"use client"

import { useEffect, useRef } from "react"
import { reduceMotion } from "../lib/motion"

const SRC = "/elestar-mark.mp4"
const POSTER = "/elestar-mark.jpg"

export default function MarkFilm() {
  const ref = useRef<HTMLVideoElement>(null)
  const still = reduceMotion()

  useEffect(() => {
    if (still) return
    const el = ref.current
    if (!el) return
    el.muted = true
    el.defaultMuted = true
    el.playsInline = true
    el.loop = false
    el.removeAttribute("autoplay")
    let started = false
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started) return
        started = true
        void el.play().then(() => io.disconnect()).catch(() => {
          started = false
        })
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [still])

  if (still) {
    return <img className="mark-film mark-film-still" src={POSTER} alt="" aria-hidden="true" />
  }

  return (
    <video
      ref={ref}
      className="mark-film"
      src={SRC}
      poster={POSTER}
      muted
      playsInline
      preload="none"
      aria-hidden="true"
    />
  )
}
