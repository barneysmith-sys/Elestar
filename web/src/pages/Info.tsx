"use client"

import type { ReactNode } from "react"
import RecordRows from "../components/RecordRows"
import SiteShell from "../components/SiteShell"
import { useRouter, type Page } from "../router"

type Block = { heading: string; body: ReactNode }

const PAGES: Partial<Record<Page, { title: string; heading: string; blocks: Block[] }>> = {
  verification: {
    title: "How verification works · Elestar",
    heading: "How verification works",
    blocks: [
      {
        heading: "What we check",
        body: "Company mail is signed by that company's server. The signature is a seal. We check the seal (DKIM), that it came from the claimed domain (SPF), and that the domain asked receivers to enforce it (DMARC). If the seal holds, the company name is real.",
      },
      {
        heading: "How you send it",
        body: "Send the original email as a file, or forward it as an attachment. A normal forward breaks the seal. We do not read the body for gossip. We read the headers to prove the mail existed.",
      },
      {
        heading: "If it fails",
        body: "If the signature does not validate, nothing gets published.",
      },
    ],
  },
  publish: {
    title: "What we publish · Elestar",
    heading: "What we publish",
    blocks: [
      {
        heading: "Two facts",
        body: (
          <RecordRows
            rows={[
              { label: "Company", value: "The firm that sent the mail." },
              { label: "Round", value: "The farthest round you sat, named in plain language." },
            ]}
          />
        ),
      },
      {
        heading: "What stays off",
        body: "Outcome, questions, take-home, why you left, and your inbox. The next company sees that the round happened. It does not see whether you got the job.",
      },
    ],
  },
  pricing: {
    title: "Pricing · Elestar",
    heading: "Pricing",
    blocks: [
      {
        heading: "Not set",
        body: "The wall is 10 people. Access is open while it stays this size. A hiring account includes the wall, the desk, and a skip note on each proved round.",
      },
      {
        heading: "Candidates",
        body: "Free for candidates, always.",
      },
    ],
  },
  access: {
    title: "Access · Elestar",
    heading: "Access",
    blocks: [
      {
        heading: "While the wall is 10",
        body: "Access is open. Price is not set. You get the wall, the desk, and a skip note on every proved round.",
      },
    ],
  },
  about: {
    title: "About · Elestar",
    heading: "About",
    blocks: [
      {
        heading: "What this is",
        body: "Elestar turns one original interview email into a verified credential. It publishes exactly two facts: the company, and the farthest round. It never publishes the outcome.",
      },
    ],
  },
  contact: {
    title: "Contact · Elestar",
    heading: "Contact",
    blocks: [
      {
        heading: "Mail",
        body: (
          <a className="linkish" href="mailto:hello@elestar.io">
            hello@elestar.io
          </a>
        ),
      },
    ],
  },
  careers: {
    title: "Careers · Elestar",
    heading: "Careers",
    blocks: [
      {
        heading: "Not hiring internally",
        body: "Elestar is not hiring for its own team right now. There is no careers list to open.",
      },
    ],
  },
  nda: {
    title: "NDA policy · Elestar",
    heading: "NDA policy",
    blocks: [
      {
        heading: "Prove the loop, not the assignment",
        body: "We never ask for the assignment. We prove the loop from the interview email. If a project round sat under NDA, the mail can still prove they sat it. The take-home stays with them. Do not send take-home files or NDA work.",
      },
    ],
  },
  remove: {
    title: "Remove a record · Elestar",
    heading: "Remove a record",
    blocks: [
      {
        heading: "Ask us",
        body: (
          <>
            Write to{" "}
            <a className="linkish" href="mailto:hello@elestar.io">
              hello@elestar.io
            </a>{" "}
            from the address on the account and name the record. We do not publish a self-serve timer or a retention period we have not set.
          </>
        ),
      },
    ],
  },
  walkthrough: {
    title: "Book a walkthrough · Elestar",
    heading: "Book a walkthrough",
    blocks: [
      {
        heading: "Write",
        body: (
          <>
            There is no booking calendar yet. Mail{" "}
            <a className="linkish" href="mailto:hello@elestar.io">
              hello@elestar.io
            </a>{" "}
            and ask for a walkthrough of the wall and the desk.
          </>
        ),
      },
    ],
  },
  privacy: {
    title: "Privacy · Elestar",
    heading: "Privacy",
    blocks: [
      {
        heading: "What a public profile shows",
        body: "Company and farthest proved round. Work you already put on the profile. Not the outcome, not the questions, not the take-home, not why you left, not your inbox.",
      },
      {
        heading: "What we have not specified",
        body: "This prototype does not publish a retention schedule, a subprocessor list, or a claim about encryption at rest. If you need a record removed, write to hello@elestar.io.",
      },
    ],
  },
  terms: {
    title: "Terms · Elestar",
    heading: "Terms",
    blocks: [
      {
        heading: "Prototype",
        body: "This is a working prototype. Access is open while the wall is 10 people. These pages are not a commercial contract. Pricing is not set.",
      },
    ],
  },
  security: {
    title: "Security · Elestar",
    heading: "Security",
    blocks: [
      {
        heading: "Mail seals",
        body: "We check SPF, DKIM, and DMARC on the original interview email. If the seal holds, the company name is real. If it does not, nothing gets published.",
      },
      {
        heading: "What we do not claim",
        body: "We do not claim a SOC audit, a pentest report, or a retention period. We do not read the body for gossip. We read the headers to prove the mail existed.",
      },
    ],
  },
  faq: {
    title: "FAQ · Elestar",
    heading: "FAQ",
    blocks: [
      {
        heading: "If they signed an NDA",
        body: "We never ask for the assignment. The interview email can still prove they sat a project round. The take-home stays with them.",
      },
      {
        heading: "If the company does not sign mail",
        body: "If DKIM does not validate, nothing gets published. We do not invent a fallback that treats unsigned mail as proved.",
      },
      {
        heading: "How a record comes down",
        body: "Write to hello@elestar.io from the address on the account and name the record.",
      },
      {
        heading: "Who can see a profile",
        body: "The public profile shows the company and the farthest round. Employers with access can open the wall and the desk. The outcome stays off it.",
      },
      {
        heading: "What stops a fake",
        body: "A normal forward breaks the seal. Forwarding the original as an attachment keeps it. We check DKIM, SPF, and DMARC. If the seal holds, the company name is real.",
      },
      {
        heading: "What it costs",
        body: "Price is not set. The wall is 10 people. Access is open while it stays this size. Free for candidates, always.",
      },
    ],
  },
}

export default function Info() {
  const { page } = useRouter()
  const copy = PAGES[page]

  if (!copy) {
    return (
      <SiteShell title="Not found · Elestar">
        <section className="hero hero-solo">
          <div className="hero-copy">
            <h1 className="type-hero">That page is not here.</h1>
          </div>
        </section>
      </SiteShell>
    )
  }

  return (
    <SiteShell title={copy.title}>
      <section className="hero hero-solo">
        <div className="hero-copy">
          <h1 className="type-hero">{copy.heading}</h1>
        </div>
      </section>
      {copy.blocks.map(block => (
        <section key={block.heading} className="site-section">
          <h2 className="type-section">{block.heading}</h2>
          {typeof block.body === "string" ? <p className="type-lede">{block.body}</p> : <div className="info-block">{block.body}</div>}
        </section>
      ))}
    </SiteShell>
  )
}
