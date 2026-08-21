"use client"

import { useEffect, useRef } from "react"
import { reduceMotion } from "../lib/motion"

const SRC = "/elestar-mark.mp4"
const POSTER = "/elestar-mark.jpg"
const FILM_IN_MS = 1100

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
    el.defaultPlaybackRate = 1
    el.preload = "auto"
    el.removeAttribute("autoplay")

    let started = false
    let inflight = false
    let visible = false
    let retries = 0
    let retryTimer = 0
    let startTimer = 0
    const clock = performance.now()
    const hero = document.getElementById("enter") ?? el.closest("section") ?? el

    function armInline() {
      el.muted = true
      el.playsInline = true
      el.loop = false
      el.playbackRate = 1
    }

    function toStart() {
      if (el.currentTime !== 0) el.currentTime = 0
    }

    function reveal() {
      el.classList.add("is-in")
    }

    function kick() {
      armInline()
      toStart()
      const play = el.play()
      if (!play) {
        started = true
        inflight = false
        reveal()
        io.disconnect()
        return
      }
      void play
        .then(() => {
          el.playbackRate = 1
          el.loop = false
          if (el.currentTime > 0.2) el.currentTime = 0
          started = true
          inflight = false
          reveal()
          io.disconnect()
        })
        .catch(() => {
          inflight = false
          el.classList.remove("is-in")
          if (retries >= 8) return
          retries += 1
          const again = () => {
            inflight = true
            kick()
          }
          if (el.readyState >= 2) {
            retryTimer = window.setTimeout(again, 180)
          } else {
            el.addEventListener("canplay", again, { once: true })
            try {
              el.load()
            } catch {
              retryTimer = window.setTimeout(again, 240)
            }
          }
        })
    }

    function tryPlay() {
      if (started || inflight || !visible) return
      const wait = Math.max(0, FILM_IN_MS - (performance.now() - clock))
      if (wait > 16) {
        window.clearTimeout(startTimer)
        startTimer = window.setTimeout(() => {
          if (started || inflight || !visible) return
          inflight = true
          kick()
        }, wait)
        return
      }
      inflight = true
      kick()
    }

    function see() {
      visible = true
      tryPlay()
    }

    function paintStart() {
      if (started || inflight || !el.paused) return
      toStart()
    }

    el.addEventListener("loadeddata", paintStart)
    el.addEventListener("loadedmetadata", paintStart)
    try {
      el.load()
    } catch {
      /* preload=auto still fetches from frame 0 */
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        see()
      },
      { threshold: narrowViewport() ? 0.02 : 0.4 },
    )
    io.observe(hero)
    if (onScreen(hero)) see()

    const retryOnWake = () => {
      if (started || document.visibilityState === "hidden") return
      tryPlay()
    }
    document.addEventListener("visibilitychange", retryOnWake)
    window.addEventListener("pageshow", retryOnWake)
    hero.addEventListener("pointerdown", retryOnWake)

    return () => {
      io.disconnect()
      window.clearTimeout(retryTimer)
      window.clearTimeout(startTimer)
      el.removeEventListener("loadeddata", paintStart)
      el.removeEventListener("loadedmetadata", paintStart)
      document.removeEventListener("visibilitychange", retryOnWake)
      window.removeEventListener("pageshow", retryOnWake)
      hero.removeEventListener("pointerdown", retryOnWake)
      try {
        el.pause()
      } catch {
        /* unmount */
      }
      el.classList.remove("is-in")
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
      preload="auto"
      aria-hidden="true"
      {...{ "webkit-playsinline": "true" }}
    />
  )
}
