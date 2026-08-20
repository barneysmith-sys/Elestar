"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { useRouter } from "../router"
import Logo from "../brand"
import HeroType from "../components/HeroType"
import poster from "../assets/elestarr-line-poster.png"
import wallMockup from "../assets/elestarr-wall-mockup.png"
import forwardEmail from "../assets/elestarr-forward-email.png"

const PILLARS = ["Work", "Interviews", "Wall", "Desk", "Profile"]

const TODAY = ["Apply", "Technical", "Panel", "Final", "Gone"]
const KEPT = ["Apply", "Technical", "Panel", "Final", "Kept"]

const SPECIMENS = [
  ["A-1842", "Backend Engineer", "FINAL ROUND", "MAY 2026", "VERIFIED"],
  ["A-2201", "Product Engineer", "SYSTEM DESIGN", "APR 2026", "ELITE"],
  ["A-0904", "Design Engineer", "PANEL", "MAR 2026", "STANDARD"],
]

const MODES = [
  {
    id: "wall",
    title: "Wall",
    line: "Scroll the work first.",
    detail: "Open a record when the work is good. Proven interviews sit next to it.",
  },
  {
    id: "pipeline",
    title: "Pipeline",
    line: "People you are considering.",
    detail: "Move them as you go. Your hiring queue, not a scoreboard.",
  },
  {
    id: "desk",
    title: "Desk",
    line: "Describe the job in sentences.",
    detail: "A shortlist of who already matches. Skip interviews they already sat.",
  },
] as const

const HOW_STEPS: [string, string, string][] = [
  ["01", "Forward the email", "Send the original recruiter email to prove@elestar.ai. Not a screenshot. Not the rest of your inbox."],
  ["02", "Elestar verifies it", "Company type, role, and how far the loop got — only if the mail supports the claim."],
  ["03", "It becomes a record", "Anonymous on the wall. Rejections stay private. Identity only after you approve an intro."],
]

function prefersReduce() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function useInView<T extends HTMLElement = HTMLElement>(threshold = 0.32) {
  const ref = useRef<T | null>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setOn(true)
        io.disconnect()
      }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, on] as const
}

function useCycle(armed: boolean, length: number, ms: number) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!armed || prefersReduce()) return
    const t = setInterval(() => setI(n => (n + 1) % length), ms)
    return () => clearInterval(t)
  }, [armed, length, ms])
  return { i, live: armed && !prefersReduce() }
}

function Reveal({ children, className = "", delay = 0, style }: { children: ReactNode; className?: string; delay?: number; style?: CSSProperties }) {
  const [ref, on] = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: on ? 1 : 0,
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

function ProductChrome() {
  return (
    <figure className="overflow-hidden" style={{ background: "var(--card)", boxShadow: "var(--paper-shadow)" }}>
      <img
        src={wallMockup}
        alt="Elestar wall. Work first, with proved interviews on each record."
        className="block w-full h-auto"
        loading="lazy"
        decoding="async"
      />
    </figure>
  )
}

function ProcessSteps({
  steps,
  interval = 1700,
  afterFirst,
}: {
  steps: [string, string, string][]
  interval?: number
  afterFirst?: ReactNode
}) {
  const [ref, on] = useInView<HTMLDivElement>(0.28)
  const { i, live } = useCycle(on, steps.length, interval)
  const progress = live ? (i + 1) / steps.length : 1

  return (
    <div ref={ref}>
      <div className="relative h-px mb-10 md:mb-12 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: "var(--border)" }} />
        <div
          className="absolute inset-y-0 left-0 origin-left"
          style={{
            width: "100%",
            background: "var(--navy)",
            transform: `scaleX(${progress})`,
            transition: live ? "transform 0.55s cubic-bezier(0.16,1,0.3,1)" : "none",
          }}
        />
      </div>
      <div className="grid gap-10 md:gap-12 md:grid-cols-3">
        {steps.map(([n, t, d], idx) => {
          const active = !live || i === idx
          const order =
            idx === 0 ? "order-1" : idx === 1 ? "order-3 md:order-2" : "order-4 md:order-3"
          return (
            <div
              key={n}
              className={order}
              style={{
                opacity: active ? 1 : 0.55,
                transform: active ? "translateY(0)" : "translateY(4px)",
                transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <p className="font-mono text-[11px] mb-3" style={{ color: "var(--navy)" }}>{n}</p>
              <h3 className="edn-lg mb-3" style={{ color: "var(--navy)" }}>{t}</h3>
              <p className="text-[15px] md:text-[16px] leading-relaxed max-w-[32ch]" style={{ color: "var(--muted-foreground)" }}>{d}</p>
            </div>
          )
        })}
        {afterFirst}
      </div>
    </div>
  )
}

function ProveIt() {
  return (
    <section id="how" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-28">
        <Reveal>
          <h2 className="edn-scene max-w-[16ch] mb-4" style={{ color: "var(--navy)" }}>
            One interview email. Never the rest of your inbox.
          </h2>
          <p className="text-[18px] leading-relaxed max-w-[42ch] mb-14" style={{ color: "var(--muted-foreground)" }}>
            Send the interview email you already have. If it is real, your profile shows how far you got. We do not grade you. We do not read anything else.
          </p>
        </Reveal>
        <ProcessSteps
          steps={HOW_STEPS}
          afterFirst={
            <figure
              className="overflow-hidden border order-2 md:order-4 md:col-span-3"
              style={{ borderColor: "var(--navy)", background: "var(--card)", boxShadow: "var(--paper-shadow)" }}
            >
              <img
                src={forwardEmail}
                alt="Forward an interview email to prove@elestar.ai. Company type, role, round, and date are parsed. The rest of the inbox stays private."
                className="block w-full h-auto"
                loading="lazy"
                decoding="async"
              />
            </figure>
          }
        />
      </div>
    </section>
  )
}

function PillarMarquee() {
  const row = [...PILLARS, ...PILLARS, ...PILLARS, ...PILLARS]
  return (
    <div className="marquee border-y py-3 md:py-4" style={{ borderColor: "var(--border)" }}>
      <div className="marquee-track">
        {row.map((w, i) => (
          <span key={`${w}-${i}`} className="flex items-baseline gap-8 md:gap-12 pr-8 md:pr-12">
            <span
              className="font-display font-extralight leading-none whitespace-nowrap"
              style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", color: "var(--navy)", letterSpacing: "-0.04em" }}
            >
              {w}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-3)" }}>
              {String((i % 5) + 1).padStart(2, "0")}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function FilmGate({ label, steps, index }: { label: string; steps: string[]; index: number }) {
  const prev = steps[(index - 1 + steps.length) % steps.length]
  const current = steps[index]
  const next = steps[(index + 1) % steps.length]
  const lost = current === "Gone"
  const kept = current === "Kept"
  return (
    <div className="film-gate px-12 py-8 min-h-[240px] flex flex-col justify-center" style={{ background: "color-mix(in srgb, var(--background) 94%, var(--navy))" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: "var(--ink-3)" }}>{label}</p>
      <p className="edn-md mb-3" style={{ color: "var(--ink-3)", opacity: 0.45 }}>{prev}</p>
      <div className="relative py-3">
        <div className="absolute left-0 right-0 top-0 h-px rule-draw" style={{ background: "var(--navy)" }} />
        <p
          key={`${label}-${current}`}
          className="stamp edn-stamp"
          style={{
            fontSize: "clamp(2rem, 4vw, 3.4rem)",
            color: kept ? "var(--verify)" : lost ? "var(--ink-3)" : "var(--navy)",
            letterSpacing: "-0.04em",
            textDecoration: lost ? "line-through" : "none",
          }}
        >
          {current}
        </p>
        <div className="absolute left-0 right-0 bottom-0 h-px" style={{ background: "var(--navy)" }} />
      </div>
      <p className="edn-md mt-3" style={{ color: "var(--ink-3)", opacity: 0.45 }}>{next}</p>
    </div>
  )
}

function DualLedger() {
  const [ref, on] = useInView<HTMLElement>(0.4)
  const { i, live } = useCycle(on, TODAY.length, 1800)
  const idx = live ? i : TODAY.length - 1
  return (
    <section ref={ref} id="signals" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-end mb-12">
          <h2 className="edn-scene max-w-[14ch]" style={{ color: "var(--navy)" }}>
            If you don't get the job, those interviews disappear.
          </h2>
          <p className="text-[18px] leading-relaxed max-w-[40ch]" style={{ color: "var(--muted-foreground)" }}>
            Four interviews. No job. LinkedIn shows none of it. If the original email is real, the wall keeps how far you got — without your name.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
          <FilmGate label="Today" steps={TODAY} index={idx} />
          <FilmGate label="On Elestar" steps={KEPT} index={idx} />
        </div>
      </div>
    </section>
  )
}

function PosterInterlude() {
  const [ref, on] = useInView<HTMLDivElement>(0.24)

  return (
    <section className="border-t" style={{ borderColor: "var(--border)" }}>
      <div ref={ref} className="max-w-[1440px] mx-auto px-5 md:px-8 py-16 md:py-24">
        <figure
          className="mx-auto max-w-[640px] overflow-hidden border"
          style={{
            borderColor: "var(--border-2)",
            background: "var(--card)",
            boxShadow: "var(--paper-shadow)",
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0) scale(1)" : "translateY(18px) scale(0.99)",
            transition: "opacity 0.85s cubic-bezier(0.16,1,0.3,1), transform 0.85s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <img
            src={poster}
            alt="Elestar editorial poster with halftone eye and tagline about work deserving something good to look at"
            className="block w-full h-auto"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </div>
    </section>
  )
}

function SignalPrinter() {
  const [ref, on] = useInView<HTMLDivElement>(0.2)
  const [spec, setSpec] = useState(0)
  const [shown, setShown] = useState(SPECIMENS[0]?.length ?? 0)
  const lines = SPECIMENS[spec] ?? SPECIMENS[0] ?? []
  const done = shown >= lines.length

  useEffect(() => {
    if (!on) return
    if (prefersReduce()) {
      setShown(lines.length)
      return
    }
    setShown(1)
    let n = 1
    const tick = setInterval(() => {
      n += 1
      if (n <= lines.length) setShown(n)
      else clearInterval(tick)
    }, 220)
    const next = setTimeout(() => {
      setSpec(s => (s + 1) % SPECIMENS.length)
    }, 220 * lines.length + 2000)
    return () => {
      clearInterval(tick)
      clearTimeout(next)
    }
  }, [on, spec, lines.length])

  return (
    <section id="issued" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div
        ref={ref}
        className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-28 grid lg:grid-cols-[1fr_0.9fr] gap-12 lg:gap-20 items-center"
      >
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4" style={{ color: "var(--navy)" }}>
            What goes on the profile
          </p>
          <h2 className="edn-scene mb-5 max-w-[16ch]" style={{ color: "var(--navy)" }}>
            Not a score. Proof of an interview.
          </h2>
          <p className="text-[17px] leading-relaxed max-w-[38ch]" style={{ color: "var(--muted-foreground)" }}>
            Company, how far you got, and that the email checked out. Employers see that next to your work. That is all we claim.
          </p>
        </div>
        <div className="relative overflow-hidden border px-7 py-8 min-h-[320px] flex flex-col" style={{ borderColor: "var(--navy)", background: "color-mix(in srgb, var(--background) 88%, var(--card))" }}>
          {on && <div className="scan-line" />}
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] mb-8" style={{ color: "var(--ink-3)" }}>Issued record</p>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <p
                key={`${spec}-${line}`}
                className={i === 2 ? "edn-stamp leading-none" : i === 0 ? "edn-lg" : "font-mono text-[12px] uppercase tracking-[0.14em]"}
                style={{
                  fontSize: i === 2 ? "clamp(1.7rem, 2.8vw, 2.4rem)" : undefined,
                  color: "var(--navy)",
                  opacity: i < shown ? 1 : 0,
                  transform: i < shown ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 0.35s cubic-bezier(0.16,1,0.3,1), transform 0.35s cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                {line}
                {i === shown - 1 && shown < lines.length && <span className="caret" />}
              </p>
            ))}
          </div>
          <div className="mt-auto pt-8 min-h-[2.5rem]">
            {done && (
              <p
                key={`seal-${spec}`}
                className="seal-in inline-block font-mono text-[10px] uppercase tracking-[0.16em] px-2 py-1 border"
                style={{ color: "var(--verify)", borderColor: "var(--verify)" }}
              >
                Mail verified
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function ModeStage() {
  const [active, setActive] = useState(0)
  const [ref, on] = useInView<HTMLDivElement>(0.3)
  useEffect(() => {
    if (!on || prefersReduce()) return
    const t = setInterval(() => setActive(n => (n + 1) % MODES.length), 3200)
    return () => clearInterval(t)
  }, [on])

  return (
    <section id="search" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div ref={ref} className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4" style={{ color: "var(--navy)" }}>If you are hiring</p>
            <h2 className="edn-scene max-w-[16ch]" style={{ color: "var(--navy)" }}>
              The wall, then your queue, then the desk.
            </h2>
          </div>
          <p className="text-[17px] max-w-[34ch]" style={{ color: "var(--muted-foreground)" }}>
            Same people. You decide from the work. Proven interviews only tell you how far another company already took them.
          </p>
        </div>
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-3">
            {MODES.map((m, i) => {
              const onMode = active === i
              return (
                <button
                  type="button"
                  key={m.id}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className="text-left py-8 md:py-10 md:px-8 border-t md:border-t-0 md:border-l first:md:border-l-0 first:border-t-0 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--navy)", opacity: onMode ? 1 : 0.45 }}>
                    {String(i + 1).padStart(2, "0")} / {m.title}
                  </p>
                  <p
                    className="edn-lg mb-3"
                    style={{
                      color: "var(--navy)",
                      opacity: onMode ? 1 : 0.58,
                      transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    {m.line}
                  </p>
                  <p
                    className="text-[15px] max-w-[30ch]"
                    style={{
                      color: "var(--muted-foreground)",
                      opacity: onMode ? 1 : 0.62,
                      transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    {m.detail}
                  </p>
                </button>
              )
            })}
          </div>
          <div
            className="hidden md:block absolute bottom-0 h-px origin-left pointer-events-none"
            style={{
              background: "var(--navy)",
              width: "33.333%",
              transform: `translateX(${active * 100}%)`,
              transition: "transform 0.55s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>
      </div>
    </section>
  )
}

function BriefWrite() {
  const blocks = [
    ["Safe to skip", "Screen", "Redundant with a verified technical already on the record."],
    ["Probe instead", "Your C-suite format", "Not on the record. Domain still is."],
    ["Never skip", "Team chemistry", "The decision-maker conversation. The desk does not touch this."],
  ] as const
  const [ref, on] = useInView<HTMLDivElement>(0.32)
  const [shown, setShown] = useState<number>(blocks.length)

  useEffect(() => {
    if (!on) return
    if (prefersReduce()) {
      setShown(blocks.length)
      return
    }
    setShown(1)
    let n = 1
    const t = setInterval(() => {
      n += 1
      setShown(n)
      if (n >= blocks.length) clearInterval(t)
    }, 480)
    return () => clearInterval(t)
  }, [on, blocks.length])

  return (
    <div ref={ref} className="relative overflow-hidden p-7 md:p-10" style={{ background: "color-mix(in srgb, var(--navy) 4%, var(--card))" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] mb-6" style={{ color: "var(--ink-3)" }}>Interview brief · after they say yes</p>
      <div className="space-y-6">
        {blocks.map(([k, t, d], i) => (
          <div
            key={k}
            style={{
              opacity: i < shown ? 1 : 0,
              transform: i < shown ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] mb-2" style={{ color: "var(--navy)" }}>{k}</p>
            <p className="edn-lg mb-1" style={{ color: "var(--navy)" }}>{t}</p>
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>{d}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DeskPitch({ onOpen }: { onOpen: () => void }) {
  return (
    <section id="desk" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-20 items-end mb-14">
          <Reveal>
            <h2 className="edn-scene max-w-[14ch]" style={{ color: "var(--navy)" }}>
              Skip interviews they already did.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[18px] leading-relaxed max-w-[44ch]" style={{ color: "var(--muted-foreground)" }}>
              Describe the job in a few sentences. You get a short list: what already matches, and what is still missing. After you say yes to an intro, you get a note of which interviews you can skip.
            </p>
            <p className="text-[16px] leading-relaxed max-w-[44ch] mt-5" style={{ color: "var(--muted-foreground)" }}>
              It never invents an interview they did not do. It suggests. You decide.
            </p>
          </Reveal>
        </div>

        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-px mb-16" style={{ background: "var(--border)" }}>
          <Reveal className="p-7 md:p-10" style={{ background: "var(--background)" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] mb-6" style={{ color: "var(--ink-3)" }}>Why this person</p>
            <p className="edn-lg mb-3" style={{ color: "var(--navy)" }}>A-1842</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] mb-6" style={{ color: "var(--muted-foreground)" }}>Series B fintech · final · systems already sampled</p>
            <p className="text-[16px] leading-relaxed max-w-[42ch] mb-6" style={{ color: "var(--foreground)" }}>
              Assessed on distributed systems and API design across a four-round loop. Both sit at the centre of this role.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--navy)" }}>
              Still missing · no C-suite presentation on the record
            </p>
          </Reveal>
          <BriefWrite />
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="btn-fill font-mono text-[12px] uppercase tracking-[0.14em] px-6 py-3.5 active:translate-y-px active:scale-[0.99]"
        >
          Open the desk
        </button>
      </div>
    </section>
  )
}

function Bridge() {
  const [ref, on] = useInView<HTMLElement>(0.38)
  return (
    <section ref={ref} id="you" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-28">
        <Reveal>
          <h2 className="edn-scene max-w-[18ch] mb-6" style={{ color: "var(--navy)" }}>
            The next company can start later.
          </h2>
          <p className="text-[18px] leading-relaxed max-w-[44ch]" style={{ color: "var(--muted-foreground)" }}>
            A startup may never hire someone already inside a public company. It can still find the person that company independently took to final.
          </p>
        </Reveal>
        <div className="mt-16 grid md:grid-cols-[1fr_auto_1fr] gap-8 md:gap-6 items-center">
          <div className="border p-7 md:p-9" style={{ borderColor: "var(--border-2)" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] mb-4" style={{ color: "var(--ink-3)" }}>If you are a candidate</p>
            <p className="edn-lg mb-3" style={{ color: "var(--navy)" }}>Those weeks still count.</p>
            <p className="text-[16px]" style={{ color: "var(--muted-foreground)" }}>The interviews live on your profile. The next company can see how far you already got.</p>
          </div>
          <div className="hidden md:flex flex-col items-center w-28 px-3" aria-hidden="true">
            <div
              className="w-full h-px origin-left"
              style={{
                background: "var(--navy)",
                transform: on ? "scaleX(1)" : "scaleX(0)",
                transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
            <p
              className="font-mono text-[10px] uppercase tracking-[0.16em] py-3"
              style={{
                color: "var(--navy)",
                opacity: on ? 1 : 0,
                transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1) 0.28s",
              }}
            >
              match
            </p>
            <div
              className="w-full h-px origin-right"
              style={{
                background: "var(--navy)",
                transform: on ? "scaleX(1)" : "scaleX(0)",
                transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.12s",
              }}
            />
          </div>
          <div className="border p-7 md:p-9" style={{ borderColor: "var(--border-2)" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] mb-4" style={{ color: "var(--ink-3)" }}>If you are an employer</p>
            <p className="edn-lg mb-3" style={{ color: "var(--navy)" }}>Someone already pressure-tested.</p>
            <p className="text-[16px]" style={{ color: "var(--muted-foreground)" }}>You are not poaching an employee. You are finding the person they already interviewed to a final, from the work and the verified loop.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  const { navigate, setWallView, setIntent, dark, toggleDark } = useRouter()
  const [solidNav, setSolidNav] = useState(false)
  const [pull, setPull] = useState(0)

  useEffect(() => {
    const hero = document.getElementById("enter")
    if (!hero) return
    const io = new IntersectionObserver((entries) => setSolidNav(!entries[0]?.isIntersecting), { threshold: 0.45 })
    io.observe(hero)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (prefersReduce()) return
    const hero = document.getElementById("enter")
    if (!hero) return
    let raf = 0
    const measure = () => {
      const r = hero.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height * 0.62)))
      setPull(p)
    }
    const onScroll = () => {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.cancelAnimationFrame(raf)
    }
  }, [])
  const goHire = () => {
    setIntent("firm")
    navigate("board")
  }
  const goList = () => {
    setIntent("creative")
    navigate("signup")
  }
  const goDesk = () => {
    setIntent("firm")
    setWallView("desk")
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden" style={{ background: "color-mix(in srgb, var(--background) 62%, transparent)", color: "var(--foreground)" }}>
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          borderColor: solidNav ? "var(--border)" : "transparent",
          background: solidNav ? "color-mix(in srgb, var(--background) 92%, transparent)" : "transparent",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 h-16 flex items-center gap-8">
          <Logo />
          <div className="hidden md:flex flex-1 justify-center gap-8 font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--navy)" }}>
            <a href="#you" className="hover:opacity-70">For you</a>
            <a href="#work" className="hover:opacity-70">Work</a>
            <a href="#signals" className="hover:opacity-70">Interviews</a>
            <a href="#desk" className="hover:opacity-70">Hiring</a>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDark}
              className="btn-icon w-10 h-10 grid place-items-center border"
              style={{ borderColor: "var(--border-2)", color: "var(--navy)" }}
              title={dark ? "Light mode" : "Dark mode"}
              aria-label={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? (
                <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={goHire}
              className="btn-fill font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2.5 active:translate-y-px active:scale-[0.99]"
            >
              Open the wall
            </button>
          </div>
        </div>
      </nav>

      <section id="enter" className="min-h-[calc(100dvh-4rem)] flex flex-col justify-center py-8 md:py-10 text-center">
        <div
          className="hero-type-pull px-4 md:px-6"
          style={{
            opacity: 1 - pull * 0.72,
            transform: `translate3d(0, ${pull * -42}px, 0)`,
            clipPath: pull > 0.02 ? `inset(0 0 ${pull * 68}% 0)` : undefined,
          } as CSSProperties}
        >
          <HeroType />
        </div>
        <div className="hero-center max-w-[1440px] mx-auto px-5 md:px-8">
        <div
          className="fade-up mt-8 md:mt-10 mx-auto grid md:grid-cols-2 gap-6 md:gap-x-16 max-w-[40rem] text-left"
          style={{ animationDelay: "0.48s" }}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--ink-3)" }}>
              Candidate
            </p>
            <p className="text-[16px] md:text-[17px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Post the work. Prove one interview with the original email. Not the inbox.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--ink-3)" }}>
              Employer
            </p>
            <p className="text-[16px] md:text-[17px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Look at the work first. Then see how far they already got. Skip that round.
            </p>
          </div>
        </div>
        <div className="fade-up mt-8 md:mt-10 flex flex-wrap items-center justify-center gap-3 md:gap-4" style={{ animationDelay: "0.6s" }}>
          <button
            type="button"
            onClick={goList}
            className="btn-fill font-mono text-[12px] uppercase tracking-[0.14em] px-6 py-3.5 active:translate-y-px active:scale-[0.99]"
          >
            I'm a candidate
          </button>
          <button
            type="button"
            onClick={goHire}
            className="btn-line font-mono text-[12px] uppercase tracking-[0.14em] px-6 py-3.5 active:translate-y-px active:scale-[0.99]"
          >
            I'm hiring
          </button>
        </div>
        <p className="fade-up mt-5 text-[15px] max-w-[36rem] mx-auto leading-relaxed" style={{ color: "var(--muted-foreground)", animationDelay: "0.72s" }}>
          Elestar is verified interview history for people who didn't get the job — and the next company that needs that signal. Forward the original recruiter email to prove@elestar.ai.
        </p>
        <p className="fade-up mt-3 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-3)", animationDelay: "0.8s" }}>
          A-1842 · reached a final · email proved
        </p>
        </div>
      </section>

      <PillarMarquee />

      <section id="work" className="scroll-mt-24 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-28">
          <Reveal>
            <h2 className="edn-scene mb-6 max-w-[16ch]" style={{ color: "var(--navy)" }}>
              Work first. Then the interview that stayed.
            </h2>
            <p className="text-[18px] leading-relaxed max-w-[42ch] mb-12 md:mb-14" style={{ color: "var(--muted-foreground)" }}>
              Employers meet you here. The work is first. How far a company already took you sits next to it, if the email is real.
            </p>
          </Reveal>
          <ProductChrome />
        </div>
      </section>

      <DualLedger />
      <ProveIt />
      <PosterInterlude />
      <SignalPrinter />
      <ModeStage />
      <DeskPitch onOpen={goDesk} />
      <Bridge />

      <section className="border-t" style={{ borderColor: "var(--navy)", background: "var(--navy)", color: "var(--primary-foreground)" }}>
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <h2
              className="font-display font-normal max-w-[12ch]"
              style={{
                fontSize: "clamp(2.8rem, 5.8vw, 5.2rem)",
                lineHeight: 0.9,
                letterSpacing: "-0.045em",
              }}
            >
              Bring one interview email.
            </h2>
            <p className="mt-4 text-[16px] max-w-[40ch]" style={{ opacity: 0.78 }}>
              Candidates: it becomes an anonymous record. Employers: you see it next to the work.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 self-start md:self-auto">
            <button
              type="button"
              onClick={goList}
              className="btn-invert font-mono text-[12px] uppercase tracking-[0.14em] px-6 py-3.5 active:translate-y-px active:scale-[0.99]"
            >
              I'm a candidate
            </button>
            <button
              type="button"
              onClick={goHire}
              className="btn-line-on-navy font-mono text-[12px] uppercase tracking-[0.14em] px-6 py-3.5 active:translate-y-px active:scale-[0.99]"
            >
              I'm hiring
            </button>
          </div>
        </div>
      </section>

      <footer className="px-5 md:px-8 py-8 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: "var(--navy)" }}>
          <Logo size="sm" />
          <p>Your interviews belong to you.</p>
          <p>Elestar · 2026</p>
        </div>
      </footer>
    </div>
  )
}
