import Link from "next/link";
import Image from "next/image";
import { Label, Mark, SectionHead } from "../components/primitives";
import { engineLabel, getCapabilities, persistenceLabel, reasoningEngine } from "../lib/capabilities";
import { K_FLOOR } from "../src/redactionAudit";

export const dynamic = "force-dynamic";

/**
 * The entry point. Deliberately short.
 *
 * This is a product console, not a marketing site — the landing page's whole
 * job is to answer "what is this" in about fifteen seconds and then get out of
 * the way. The real explanation is the pipeline running on live input, which is
 * one click from here.
 */
export default function HomePage() {
  const capabilities = getCapabilities();
  const engine = reasoningEngine();

  return (
    <>
      {/* ---- hero ---------------------------------------------------------- */}
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 88 }}>
        <div className="split-wide" style={{ alignItems: "center", gap: 64 }}>
          <div className="stack-6">
            <Label>An intelligence layer for hiring</Label>

            <h1 className="display-xl" style={{ maxWidth: "20ch" }}>
              Every interview
              <br />
              generates evidence.
              <br />
              <span style={{ fontStyle: "italic", fontWeight: 300 }}>Almost all of it</span>
              <br />
              disappears.
            </h1>

            <p className="lede" style={{ maxWidth: "52ch" }}>
              Candidates repeat interviews they have already passed. Hiring teams rebuild processes
              they have already run. Elestar captures what a process actually tested, verifies it,
              strips it of identity, and makes it reusable.
            </p>

            <div className="row-wrap" style={{ gap: 12 }}>
              <Link href="/list" className="btn-primary" style={{ textDecoration: "none" }}>
                Run the pipeline
              </Link>
              <Link href="/circuit" className="btn-ghost" style={{ textDecoration: "none" }}>
                See the Circuit
              </Link>
            </div>

            <div className="row-wrap" style={{ gap: 8 }}>
              <span className={`engine-badge engine-${engine}`}>{engineLabel(engine)}</span>
              <span className="chip">{persistenceLabel(capabilities.persistence)}</span>
              <span className="chip">No credentials required</span>
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

      {/* ---- the loop ------------------------------------------------------ */}
      <section className="wrap section-sm" style={{ borderTop: "1px solid var(--border)" }}>
        <SectionHead
          kicker="The idea"
          title="A process goes in. Reusable intelligence comes out."
          sub="Nine steps, in order. Each one is a real stage in the repository, and you can watch all of them execute on your own input."
        />

        <div className="grid-cards">
          {[
            { n: "01", t: "Ingest", d: "A candidate describes the loop in their own words." },
            { n: "02", t: "Redact", d: "Identifiers are stripped on the server, before any prompt exists." },
            { n: "03", t: "Structure", d: "Prose becomes typed rounds, competencies and tested depth." },
            { n: "04", t: "Verify", d: "Deterministic tier rules. Rounds cleared decides it; brand never does." },
            { n: "05", t: "Privacy audit", d: `Re-identification risk scored against a hard k=${K_FLOOR} cohort floor.` },
            { n: "06", t: "Publish", d: "An anonymous record enters the pool — or does not, and stays private." },
            { n: "07", t: "Search", d: "A hiring team describes a role and gets ranked, explainable matches." },
            { n: "08", t: "Intro", d: "The candidate approves. That is the only way identity moves." },
            { n: "09", t: "Brief", d: "What was tested, what to skip, what to probe, what is still unknown." },
          ].map((step) => (
            <div key={step.n} className="card-flat stack-3 hoverable">
              <div className="row" style={{ gap: 10 }}>
                <span className="label" style={{ fontSize: 9 }}>{step.n}</span>
                <span className="label-ink">{step.t}</span>
              </div>
              <p className="body-sm" style={{ color: "var(--ink)" }}>{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- what it is not ------------------------------------------------ */}
      <section className="wrap section-sm">
        <div className="split" style={{ gap: 56 }}>
          <div className="stack-4">
            <Label>What this is not</Label>
            <ul className="stack-2" style={{ listStyle: "none" }}>
              {[
                "A job board",
                "A resume database",
                "A candidate marketplace",
                "An interview coach",
                "A recruiting CRM",
                "A dashboard of AI numbers that mean nothing",
              ].map((item) => (
                <li key={item} className="row" style={{ gap: 12 }}>
                  <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>—</span>
                  <span className="body-text" style={{ color: "var(--muted)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="stack-4">
            <Label>What it is</Label>
            <p className="display-md" style={{ maxWidth: "26ch" }}>
              A privacy-preserving intelligence network for interview processes.
            </p>
            <p className="body-text" style={{ maxWidth: "56ch" }}>
              The asset is structured, verified interview evidence — what was tested, how deeply, what
              happened, and how much of it is actually known. Identity is a separate thing, and it moves
              only when a candidate says so.
            </p>
            <Link href="/system" className="link-quiet" style={{ textDecoration: "none" }}>
              How the system works →
            </Link>
          </div>
        </div>
      </section>

      {/* ---- privacy ------------------------------------------------------- */}
      <section className="wrap section-sm" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="split-narrow" style={{ gap: 48 }}>
          <div className="stack-3">
            <Label>Privacy</Label>
            <h2 className="display-md">Enforced in Postgres, not in the interface</h2>
          </div>

          <div className="stack-6">
            <p className="body-text" style={{ maxWidth: "68ch" }}>
              A recruiter query must not be <em>able</em> to return an unreleased identity. So the raw
              submission is owner-only at the row level, the browsable record is a whitelisted projection
              with no identity column, and a database constraint makes an identity on an unapproved intro
              request impossible — regardless of what application code tries to write.
            </p>

            <div className="cols-3">
              {[
                { t: "Redaction first", d: "Runs before any prompt is built. If it throws, the pipeline stops rather than falling back to raw text." },
                { t: `k=${K_FLOOR} floor`, d: "A record with too few cohort peers is generalised or withheld. The floor overrides any judgement that says publish." },
                { t: "Fails closed", d: "Every error path ends somewhere other than a live public record. An annoyed candidate beats a leaked one." },
              ].map((item) => (
                <div key={item.t} className="stack-2">
                  <span className="label-ink">{item.t}</span>
                  <p className="body-sm">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- cta ----------------------------------------------------------- */}
      <section className="dark">
        <div className="wrap section" style={{ textAlign: "center" }}>
          <div className="stack-6" style={{ alignItems: "center" }}>
            <Mark size={22} />
            <h2 className="display-lg" style={{ maxWidth: "24ch", margin: "0 auto" }}>
              Watch it structure a real interview process
            </h2>
            <p className="lede" style={{ maxWidth: "52ch", margin: "0 auto" }}>
              Paste a loop, or use one of the examples. One of them is built not to publish, because the
              privacy audit is the part worth seeing.
            </p>
            <Link href="/list" className="btn-primary" style={{ textDecoration: "none" }}>
              Run the pipeline
            </Link>
          </div>
        </div>
      </section>

      <footer className="wrap section-sm">
        <div className="row-between stack-mobile" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 10 }}>
            <Mark size={14} />
            <Label>Elestar</Label>
          </div>
          <div className="row-wrap" style={{ gap: 20 }}>
            <Link href="/list" className="nav-link">List a process</Link>
            <Link href="/circuit" className="nav-link">Circuit</Link>
            <Link href="/search" className="nav-link">Search</Link>
            <Link href="/intros" className="nav-link">Intros</Link>
            <Link href="/system" className="nav-link">System</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
