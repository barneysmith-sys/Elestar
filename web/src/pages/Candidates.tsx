"use client"

import { useRouter as useNextRouter } from "next/navigation"
import { useRouter } from "../router"
import RecordRows from "../components/RecordRows"
import SiteShell from "../components/SiteShell"
import UnresolvedField from "../components/UnresolvedField"

export default function Candidates() {
  const { navigate, setIntent, signedIn } = useRouter()
  const nextRouter = useNextRouter()

  const prove = () => {
    setIntent("creative")
    if (signedIn) nextRouter.push("/verify")
    else navigate("signup")
  }

  return (
    <SiteShell title="Candidates · Elestar">
      <section className="hero hero-solo">
        <div className="hero-copy">
          <h1 className="type-hero">
            Your interview belongs to you.
            <br />
            <span className="type-hero-mid">You are publishing that the round happened.</span>
          </h1>
          <p className="type-lede">
            You are not publishing that you got rejected. The next company sees the company and the farthest round. It never sees the outcome, the questions, or why you left.
          </p>
          <div className="cta-row">
            <button type="button" className="btn btn-fill" onClick={prove}>
              Prove a round
            </button>
          </div>
        </div>
      </section>

      <section className="site-section">
        <h2 className="type-section">You already have the email.</h2>
        <RecordRows
          rows={[
            {
              label: "01",
              value: "Forward the original recruiter email as an attachment to prove@elestar.ai, or drop the .eml on Verify.",
            },
            {
              label: "02",
              value: "The pipeline reads SPF, DKIM, and DMARC from that original. A missing seal is unknown, never assumed pass.",
            },
            {
              label: "03",
              value: "If the seal holds, company and farthest round publish. The outcome stays off the profile.",
            },
          ]}
        />
      </section>

      <section className="site-section">
        <h2 className="type-section">What appears on your profile.</h2>
        <RecordRows
          rows={[
            { label: "Company", value: "The firm that sent the mail." },
            { label: "Round", value: "The farthest round you sat, named in plain language." },
            { label: "Seal", value: "spf / dkim / dmarc as they appeared on the original mail." },
            { label: "Work", value: "The portfolio you already made. That sits first." },
          ]}
        />
      </section>

      <section className="site-section">
        <div className="panel panel-refusal">
          <h2 className="type-section">What never does.</h2>
          <RecordRows
            rows={[
              { label: "Outcome", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
              { label: "Questions", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
              { label: "Take-home", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
              { label: "Why you left", state: "unresolved", value: <UnresolvedField live label="Not published" /> },
            ]}
          />
        </div>
      </section>

      <section className="site-section">
        <h2 className="type-section">Those weeks still count.</h2>
        <p className="type-lede">
            Create a candidate account. Prove one round today. Your profile shows the company and the round. Not the result.{" "}
            <button type="button" className="linkish" onClick={() => navigate("manifesto")}>
              What we believe
            </button>
            .
          </p>
        <button type="button" className="btn btn-fill" onClick={prove}>
          Prove a round
        </button>
      </section>
    </SiteShell>
  )
}
