"use client"

import { useRouter } from "../router"
import RecordRows from "../components/RecordRows"
import SiteShell from "../components/SiteShell"
import UnresolvedField from "../components/UnresolvedField"

const BELIEFS: { heading: string; body: string }[] = [
  {
    heading: "The round happened.",
    body: "The credential is that it sat. Not that it was won.",
  },
  {
    heading: "Your interview belongs to you.",
    body: "You publish that the round happened. You do not publish that you got rejected.",
  },
  {
    heading: "Those weeks still count.",
    body: "The next desk can skip what you already sat. You are not starting from zero. They are not buying a rerun.",
  },
  {
    heading: "Two facts go on the wall.",
    body: "Company. Farthest round. Work already on the profile. Nothing else.",
  },
  {
    heading: "The assignment stays private.",
    body: "We prove the loop from the original interview email. We never ask for the take-home. If an NDA sat on the project, the mail can still prove the round.",
  },
  {
    heading: "Chemistry is still the room.",
    body: "Skip the screen that already ran. Keep the conversation that decides.",
  },
  {
    heading: "Prestige is not a sort.",
    body: "A proved Stripe final and a proved unknown final are the same class of fact: the loop sat.",
  },
  {
    heading: "Candidates supply. Companies pay.",
    body: "Free for candidates, always. Access is open while the wall is 10. Price is not set.",
  },
]

export default function Manifesto() {
  const { navigate, setIntent } = useRouter()

  return (
    <SiteShell title="Manifesto · Elestar">
      <section className="hero hero-solo">
        <div className="hero-copy">
          <h1 className="type-hero">
            What we believe.
            <br />
            <span className="type-hero-mid">The credential is that the round happened.</span>
          </h1>
          <p className="type-lede">
            For the person who sat the loop, and the desk that is about to rerun it.
          </p>
        </div>
      </section>

      <div className="manifesto">
        {BELIEFS.map(belief => (
          <section key={belief.heading} className="site-section manifesto-belief">
            <h2 className="type-section">{belief.heading}</h2>
            <p className="type-lede">{belief.body}</p>
          </section>
        ))}

        <section className="site-section">
          <div className="panel panel-refusal">
            <h2 className="type-section">Outcome stays unresolved.</h2>
            <RecordRows
              rows={[
                { label: "Outcome", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
                { label: "Questions", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
                { label: "Take-home", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
                { label: "Why they left", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
              ]}
            />
            <p className="type-lede refusal-note">
              The next company sees the round. Not whether they got the job.
            </p>
          </div>
        </section>

        <section className="site-section">
          <div className="fork">
            <article className="panel panel-solid">
              <h2 className="type-section">You sat the rounds.</h2>
              <p className="type-lede">Forward one email. The company and the round go on your profile. The result does not.</p>
              <p className="type-label fork-flag">Free for candidates, always</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIntent("creative")
                  navigate("candidates")
                }}
              >
                I have interviews to prove
              </button>
            </article>
            <article className="panel panel-solid">
              <h2 className="type-section">You run the loop.</h2>
              <p className="type-lede">A round another company already ran is a round you can skip.</p>
              <p className="type-caption fork-flag">Access is open while the wall is 10. Price not set.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIntent("firm")
                  navigate("hiring")
                }}
              >
                I'm hiring
              </button>
            </article>
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
