"use client"

import { useRouter } from "../router"
import { reduceMotion } from "../lib/motion"
import HeroField from "./HeroField"
import MarkFilm from "./MarkFilm"

export default function HeroResolve() {
  const { navigate } = useRouter()
  const still = reduceMotion()

  return (
    <section className="hero hero-resolve" id="enter">
      <HeroField still={still} />
      <div className="hero-resolve-stack">
        <h1 className="hero-title">
          <span className="ink-resolve">The round happened.</span>
          <br />
          <span className="hero-title-mid ink-resolve">Prove it once. Hire past it.</span>
        </h1>
        <p className="hero-lede">
          <span className="ink-resolve">One original interview email posts the company and the farthest round.</span>
        </p>
        <div className="hero-film-stage">
          <div className="hero-film-frame">
            <MarkFilm />
          </div>
        </div>
        <div className="cta-row hero-ctas">
          <button type="button" className="btn" onClick={() => navigate("candidates")}>
            <span className="ink-resolve">I have interviews to prove</span>
          </button>
          <button type="button" className="btn" onClick={() => navigate("hiring")}>
            <span className="ink-resolve">I'm hiring</span>
          </button>
        </div>
        <p className="hero-privacy">
          <span className="ink-resolve">We publish the company and the round. Never the outcome.</span>
        </p>
      </div>
    </section>
  )
}
