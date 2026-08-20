"use client"

import { useRouter } from "../router"
import ProfileWall from "../components/ProfileWall"
import RecordRows from "../components/RecordRows"
import SiteShell from "../components/SiteShell"
import UnresolvedField from "../components/UnresolvedField"
import { wallPeople } from "../data"

const WALL_COUNT = wallPeople().length

export default function Hiring() {
  const { navigate, setIntent } = useRouter()

  const open = () => {
    setIntent("firm")
    navigate("signup")
  }

  return (
    <SiteShell title="Hiring · Elestar">
      <section className="hero hero-solo">
        <div className="hero-copy">
          <h1 className="type-hero">
            A screen another company already ran
            <br />
            <span className="type-hero-mid">is a round you can skip.</span>
          </h1>
          <p className="type-lede">
            You look at the work. You read the company and the farthest proved round. You do not rerun that round.
          </p>
          <div className="cta-row">
            <button type="button" className="btn btn-fill" onClick={open}>
              Create a hiring account
            </button>
          </div>
          <p className="type-caption">
            You get the wall and a skip note on every proved round, today.{" "}
            <button type="button" className="linkish" onClick={() => navigate("manifesto")}>
              What we believe
            </button>
            .
          </p>
        </div>
      </section>

      <section className="site-section">
        <h2 className="type-section">What access costs.</h2>
        <RecordRows
          rows={[
            {
              label: "Price",
              value: "Not set. The wall is 10 people. Access is open while it stays this size.",
            },
            {
              label: "Includes",
              value: "The wall, the desk, and a skip note on each proved round.",
            },
            {
              label: "Does not",
              value: "Outcome, questions, take-home, or why they left.",
            },
          ]}
        />
      </section>

      <section className="site-section">
        <h2 className="type-section">{WALL_COUNT} people on the wall right now.</h2>
        <p className="type-lede">
          That is the real number. It is a prototype inventory, not a marketplace claim.
        </p>
        <ProfileWall />
      </section>

      <section className="site-section">
        <h2 className="type-section">How you skip a round.</h2>
        <RecordRows
          rows={[
            { label: "01", value: "Open the wall. Work first." },
            { label: "02", value: "Open the person. Company and farthest round sit next to the work." },
            { label: "03", value: "Skip that round in your loop. You still run chemistry and the decision conversation." },
          ]}
        />
      </section>

      <section className="site-section">
        <h2 className="type-section">If they signed an NDA.</h2>
        <p className="type-lede">
          We never ask for the assignment. We prove the loop from the interview email. If a project round sat under NDA, the mail can still prove they sat it. The take-home stays with them.
        </p>
      </section>

      <section className="site-section">
        <h2 className="type-section">What stops a fake.</h2>
        <p className="type-lede">
          Company mail is signed by that company's server. The signature is a seal. A normal forward breaks it. Forwarding the original as an attachment keeps it. We check the seal (DKIM), that it came from the claimed domain (SPF), and that the domain asked receivers to enforce it (DMARC). If the seal holds, the company name is real. We do not read the body for gossip. We read the headers to prove the mail existed.
        </p>
      </section>

      <section className="site-section">
        <div className="panel panel-refusal">
          <h2 className="type-section">You do not see whether they got the job.</h2>
          <RecordRows
            rows={[
              { label: "Outcome", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
            ]}
          />
          <p className="type-lede refusal-note">
            A rejection after final is not a failed person. It is a process they completed. The credential is that they sat the round, not that they won it. If you need the outcome, you are buying a different product. Trust the work, and the fact that another desk already ran that hour.
          </p>
        </div>
      </section>

      <section className="site-section">
        <h2 className="type-section">Create a hiring account.</h2>
        <p className="type-lede">
          You get the wall and a skip note on every proved round, today. No waitlist. Ten people. That is the inventory.
        </p>
        <button type="button" className="btn btn-fill" onClick={open}>
          Create a hiring account
        </button>
      </section>
    </SiteShell>
  )
}
