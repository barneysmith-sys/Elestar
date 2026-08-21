"use client"

import { useEffect, useRef } from "react"
import { reduceMotion } from "../lib/motion"

const SRC = "/elestar-mark.mp4"
const POSTER = "/elestar-mark.jpg"

function narrowViewport() {
  return window.matchMedia("(max-width: 640px)").matches
}

function onScreen(node: Element) {
  const rect = node.getBoundingClientRect()
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0
}

export default function MarkFilm() {
  const ref = useRef<HTMLVideoElement>(null)
  const still = reduceMotion()

  useEffect(() => {
    if (still) return
    const el = ref.current
    if (!el) return

    el.muted = true
    el.defaultMuted = true
    el.setAttribute("muted", "")
    el.playsInline = true
    el.setAttribute("playsinline", "true")
    el.setAttribute("webkit-playsinline", "true")
    el.loop = false
    el.playbackRate = 1
    el.removeAttribute("autoplay")

    let started = false
    let inflight = false
    let retried = false
    let retryTimer = 0
    const hero = document.getElementById("enter") ?? el.closest("section") ?? el

    function kick() {
      el.muted = true
      const play = el.play()
      if (!play) {
        started = true
        inflight = false
        io.disconnect()
        return
      }
      void play
        .then(() => {
          started = true
          inflight = false
          io.disconnect()
        })
        .catch(() => {
          inflight = false
          if (retried) {
            started = false
            return
          }
          retried = true
          const again = () => {
            inflight = true
            kick()
          }
          if (el.readyState >= 2) {
            retryTimer = window.setTimeout(again, 160)
          } else {
            el.addEventListener("canplay", again, { once: true })
            el.load()
          }
        })
    }

    function tryPlay() {
      if (started || inflight) return
      inflight = true
      kick()
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        tryPlay()
      },
      { threshold: narrowViewport() ? 0.02 : 0.4 },
    )

    io.observe(hero)
    if (onScreen(hero)) tryPlay()

    return () => {
      io.disconnect()
      window.clearTimeout(retryTimer)
    }
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
      {...{ "webkit-playsinline": "true" }}
    />
  )
}
