import Link from "next/link";
import Image from "next/image";
import { Label, Mark } from "../components/primitives";
import { engineLabel, getCapabilities, persistenceLabel, reasoningEngine } from "../lib/capabilities";
import { PROVE_INBOX } from "../lib/ingest/inbound";
import { K_FLOOR } from "../src/redactionAudit";

export const dynamic = "force-dynamic";

const LOOP = [
  { n: "01", t: "Work", d: "You already did the interviews, projects, and rounds." },
  { n: "02", t: "Interview", d: "A company took you somewhere in its loop." },
  { n: "03", t: "Prove it", d: `Forward that recruiter email to ${PROVE_INBOX}.` },
  { n: "04", t: "Verified history", d: "How far you got becomes a private-evidence, public-signal record." },
  { n: "05", t: "Get discovered", d: "Employers find you through what was tested, not a resume." },
  { n: "06", t: "Skip redundant rounds", d: "If the signal holds, they don't have to re-run what you already passed." },
];

/**
 * First screen: what this is, how it verifies, why it matters — in that order.
 * Visual language is Josh's. Product claims are Elestar's.
 */
export default function HomePage() {
  const capabilities = getCapabilities();
  const engine = reasoningEngine();

  return (
    <>
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 72 }}>
        <div className="split-wide" style={{ alignItems: "center", gap: 64 }}>
          <div className="stack-6">
            <Label>Elestar</Label>
            <h1 className="display-xl" style={{ maxWidth: "18ch" }}>
              Your interview history shouldn&rsquo;t disappear when you don&rsquo;t get the job.
            </h1>
            <p className="lede" style={{ maxWidth: "46ch" }}>
              Prove how far you got. Keep the signal. Forward the recruiter email to{" "}
              <span className="mono-sm" style={{ fontSize: 15 }}>{PROVE_INBOX}</span>.
            </p>

            <div className="row-wrap" style={{ gap: 12 }}>
              <Link href="/list" className="btn-primary" style={{ textDecoration: "none" }}>
                Verify an interview
              </Link>
              <Link href="/circuit" className="btn-ghost" style={{ textDecoration: "none" }}>
                See verified records
              </Link>
            </div>

            <div className="row-wrap" style={{ gap: 8 }}>
              <span className={`engine-badge engine-${engine}`}>{engineLabel(engine)}</span>
              <span className="chip">{persistenceLabel(capabilities.persistence)}</span>
            </div>
          </div>

          <div style={{ position: "relative", aspectRatio: "3 / 4", minHeight: 320 }}>
            <Image
              src="/art/poster.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 440px"
              style={{ objectFit: "cover", objectPosition: "center top", borderRadius: 3 }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to right, var(--bg) 0%, transparent 26%)",
              }}
            />
          </div>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 56 }}>
        <div className="split" style={{ gap: 40 }}>
          <div className="card-flat stack-3">
            <Label>Candidate</Label>
            <p className="display-sm">Post the work. Prove one interview with the original email.</p>
            <p className="body-sm">Not the rest of your inbox. Not a recruiter address typed into a form.</p>
          </div>
          <div className="card-flat stack-3">
            <Label>Employer</Label>
            <p className="display-sm">See what was already evaluated. Skip the rounds that already happened.</p>
            <p className="body-sm">Work first. Then verified interview signals. Identity only after they approve an intro.</p>
          </div>
        </div>
      </section>

      <section className="wrap section-sm" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="stack-4" style={{ marginBottom: 36 }}>
          <Label>The loop</Label>
          <h2 className="display-md" style={{ maxWidth: "22ch" }}>Work. Interview. Prove it. Keep it.</h2>
        </div>
        <div className="grid-cards">
          {LOOP.map((step) => (
            <div key={step.n} className="card-flat stack-3">
              <div className="row" style={{ gap: 10 }}>
                <span className="label" style={{ fontSize: 9 }}>{step.n}</span>
                <span className="label-ink">{step.t}</span>
              </div>
              <p className="body-sm" style={{ color: "var(--ink)" }}>{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap section-sm" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="split-narrow" style={{ gap: 48, alignItems: "start" }}>
          <div className="stack-3">
            <Label>How Elestar verifies it</Label>
            <h2 className="display-md" style={{ maxWidth: "16ch" }}>One interview email. Never the rest of your inbox.</h2>
          </div>
          <div className="stack-5">
            <p className="body-text" style={{ maxWidth: "58ch" }}>
              Forward the original recruiter or interview email to {PROVE_INBOX}. Elestar parses company,
              role, and how far the loop got, checks public evidence, then publishes only an anonymous
              signal — after privacy and a k={K_FLOOR} cohort floor both pass.
            </p>
            <div className="card-flat row-between stack-mobile" style={{ padding: "16px 18px", gap: 12 }}>
              <div className="stack-2">
                <Label>Forward to</Label>
                <span className="mono-sm" style={{ fontSize: 16, color: "var(--ink)" }}>{PROVE_INBOX}</span>
              </div>
              <Link href="/list" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
                Watch the pipeline
              </Link>
            </div>
            <p className="body-sm" style={{ fontSize: 12, maxWidth: "62ch" }}>
              Raw mail, recruiter names, and confidential project material stay private. Public output is
              company type, role, stage, competencies, and verification status.
            </p>
          </div>
        </div>
      </section>

      <section className="wrap section-sm">
        <div className="split" style={{ gap: 24 }}>
          <div className="card stack-4">
            <Label>Today</Label>
            <p className="display-sm">Apply → technical → panel → final → gone.</p>
            <p className="body-sm">LinkedIn shows none of it. The next company starts from zero.</p>
          </div>
          <div className="card stack-4" style={{ borderColor: "rgba(45,90,39,0.35)" }}>
            <Label>On Elestar</Label>
            <p className="display-sm">Apply → technical → panel → final → kept.</p>
            <p className="body-sm">If the email is real, how far you got stays on the record.</p>
          </div>
        </div>
      </section>

      <section className="wrap section-sm" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="stack-4" style={{ marginBottom: 28 }}>
          <Label>Why it compounds</Label>
          <h2 className="display-md" style={{ maxWidth: "24ch" }}>Every verified interview makes the next hire cheaper to evaluate.</h2>
        </div>
        <div className="cols-4">
          {[
            { t: "More candidates", d: "More verified loops enter the pool." },
            { t: "Better signals", d: "Signals shows what companies actually test." },
            { t: "Better discovery", d: "Search ranks people on evaluated work." },
            { t: "More employers", d: "Fewer redundant rounds, more reason to look here." },
          ].map((item) => (
            <div key={item.t} className="stack-2">
              <span className="label-ink">{item.t}</span>
              <p className="body-sm">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dark">
        <div className="wrap section" style={{ textAlign: "center" }}>
          <div className="stack-6" style={{ alignItems: "center" }}>
            <Mark size={22} />
            <h2 className="display-lg" style={{ maxWidth: "18ch", margin: "0 auto" }}>
              Bring one interview email.
            </h2>
            <p className="lede" style={{ maxWidth: "48ch", margin: "0 auto" }}>
              Candidates: it becomes verified history. Employers: you see it next to what was tested.
            </p>
            <div className="row-wrap" style={{ gap: 12, justifyContent: "center" }}>
              <Link href="/list" className="btn-primary" style={{ textDecoration: "none" }}>
                I&rsquo;m a candidate
              </Link>
              <Link href="/search" className="btn-ghost" style={{ textDecoration: "none", color: "var(--dark-ink)", borderColor: "var(--dark-border)" }}>
                I&rsquo;m hiring
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="wrap section-sm">
        <div className="row-between stack-mobile" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 10 }}>
            <Mark size={14} />
            <Label>Your interviews belong to you.</Label>
          </div>
          <div className="row-wrap" style={{ gap: 20 }}>
            <Link href="/list" className="nav-link">Verify</Link>
            <Link href="/circuit" className="nav-link">Circuit</Link>
            <Link href="/search" className="nav-link">Search</Link>
            <Link href="/signals" className="nav-link">Signals</Link>
            <Link href="/system" className="nav-link">System</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
