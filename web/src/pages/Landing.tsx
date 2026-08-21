"use client"

import { useEffect } from "react"
import { useRouter } from "../router"
import DkimExhibit from "../components/DkimExhibit"
import Enter from "../components/Enter"
import HeroResolve from "../components/HeroResolve"
import ProfileWall from "../components/ProfileWall"
import RecordRows from "../components/RecordRows"
import RefusalRows from "../components/RefusalRows"
import SiteShell from "../components/SiteShell"
import { wallPeople } from "../data"

const WALL_COUNT = wallPeople().length

export default function Landing() {
  const { navigate } = useRouter()

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) el.scrollIntoView()
  }, [])

  return (
    <SiteShell>
      <HeroResolve />

      <section className="cost" id="cost">
        <Enter>
          <div className="surface cost-copy enter-item">
            <h2 className="type-section">Four weeks. Three conversations. One take-home you did on a Sunday.</h2>
          </div>
        </Enter>
      </section>

      <section className="site-section" id="mechanic">
        <Enter className="mechanic">
          <div className="mechanic-steps surface enter-item">
            <h2 className="type-section">Name it. Send it. It posts.</h2>
            <RecordRows
              rows={[
                { label: "01", value: "Name the interview." },
                { label: "02", value: "Send the original. A forward breaks the seal." },
                { label: "03", value: "Company and round post. Result stays off." },
              ]}
            />
          </div>
          <div className="mechanic-dkim enter-item">
            <DkimExhibit />
            <p className="type-caption">If the signature does not validate, nothing gets published.</p>
          </div>
        </Enter>
      </section>

      <section className="site-section" id="wall">
        <Enter>
          <div className="surface wall-lead enter-item">
            <h2 className="type-section">{WALL_COUNT} people on the wall.</h2>
          </div>
          <div className="enter-item">
            <ProfileWall />
          </div>
        </Enter>
      </section>

      <section className="belongs" id="belongs">
        <Enter>
          <h2 className="type-thesis surface enter-item">
            <span className="ink-resolve">Your interview belongs to you.</span>
          </h2>
        </Enter>
      </section>

      <section className="site-section" id="refusal">
        <Enter>
          <div className="panel panel-solid panel-refusal enter-item">
            <h2 className="type-section">What we do not publish.</h2>
            <RefusalRows />
            <p className="type-lede refusal-note">The next company sees the round. Not whether they got the job.</p>
          </div>
        </Enter>
      </section>

      <section className="site-section" id="fork">
        <Enter className="fork">
          <article className="panel panel-solid enter-item">
            <h2 className="type-section">You sat the rounds.</h2>
            <p className="type-lede">Forward one email. The company and the round go on your profile. The result does not.</p>
            <p className="type-label fork-flag">Free for candidates, always</p>
            <button type="button" className="btn" onClick={() => navigate("candidates")}>
              <span className="ink-resolve">I have interviews to prove</span>
            </button>
          </article>
          <article className="panel panel-solid enter-item">
            <h2 className="type-section">You run the loop.</h2>
            <p className="type-lede">A round another company already ran is a round you can skip.</p>
            <p className="type-caption fork-flag">Access is open while the wall is 10. Price not set.</p>
            <button type="button" className="btn" onClick={() => navigate("hiring")}>
              <span className="ink-resolve">I'm hiring</span>
            </button>
          </article>
        </Enter>
      </section>
    </SiteShell>
  )
}
