import Link from "next/link";
import { SystemModel } from "../../components/SystemModel";
import { Label, SectionHead } from "../../components/primitives";
import { engineLabel, getCapabilities, persistenceLabel, reasoningEngine } from "../../lib/capabilities";
import { K_FLOOR } from "../../src/redactionAudit";
import { DEPTH_WEIGHT } from "../../src/matchRecords";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System — Elestar",
  description: "What is deterministic, what is judgement, and where privacy is enforced.",
};

/**
 * The "is this real?" page.
 *
 * Written for the technical reader who wants to know which claims are load
 * bearing. It names modules, constants and the exact conditions under which
 * each stage degrades, because the alternative — a vague architecture diagram —
 * is the thing that makes people assume none of it works.
 */
export default function SystemPage() {
  const capabilities = getCapabilities();
  const engine = reasoningEngine();

  return (
    <>
      <div className="wrap section">
        <SectionHead
          kicker="System"
          title="What is real, and what degrades"
          sub="Elestar has two external dependencies: a model provider for the judgement stages, and Supabase for persistence. Either can be absent. This page says exactly what changes when they are."
          right={<span className={`engine-badge engine-${engine}`}>{engineLabel(engine)}</span>}
        />

        <div className="split" style={{ gap: 48, marginBottom: 64 }}>
          <div className="stack-4">
            <Label>Always real — deterministic rules</Label>
            <div className="stack-3">
              {[
                { t: "PII redaction", d: "Emails, phone numbers, URLs, handles and known names, stripped before any prompt is constructed.", m: "src/redact.ts" },
                { t: "Tier ladder", d: "Rounds cleared is primary. A known offer rate promotes by at most one rung; loop length can only demote; confidence under 0.6 caps at verified. Brand is not an input.", m: "computeTier()" },
                { t: `k-anonymity floor`, d: `A record with fewer than ${K_FLOOR} cohort peers cannot publish, whatever the risk read concluded.`, m: "src/redactionAudit.ts" },
                { t: "Evidence depth weighting", d: `assessed ${DEPTH_WEIGHT.assessed} · probed ${DEPTH_WEIGHT.probed} · mentioned ${DEPTH_WEIGHT.mentioned}. A competency that only came up in conversation is worth almost nothing.`, m: "src/matchRecords.ts" },
                { t: "Recency discounting", d: "Under 3 months 1.0×, under 6 months 0.9×, under 12 months 0.75×, older 0.5×.", m: "recencyMultiplier()" },
                { t: "Fail-closed gating", d: "Every error path in the pipeline ends in withheld or pending review. None of them end in a live public record.", m: "lib/pipeline.ts" },
                { t: "Recruiter-email isolation", d: "The mailbox is a verification credential, not public identity. It is stored owner-only on processes and asserted absent from every public payload.", m: "lib/verify/email.ts" },
              ].map((item) => (
                <div key={item.t} className="card-flat stack-2">
                  <div className="row-between" style={{ gap: 12 }}>
                    <span className="label-ink">{item.t}</span>
                    <span className="chip chip-ok">Deterministic</span>
                  </div>
                  <p className="body-sm">{item.d}</p>
                  <span className="mono-sm" style={{ color: "var(--muted)", fontSize: 10 }}>{item.m}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stack-4">
            <Label>Judgement — degrades, and says so</Label>
            <div className="stack-3">
              {[
                { t: "Structuring", d: "Prose into typed rounds and competencies. Without a model, a rule-based parser reads the same signals and shows every rule that fired. It is weaker on unusual prose and admits it.", m: "src/parseProcess.ts / lib/reasoners/parse.ts" },
                { t: "Re-identification risk", d: "How identifying a record is. Without a model, quasi-identifiers are scored by weight. There is deliberately no fallthrough if a configured model fails — a failed privacy read withholds rather than retrying on something weaker.", m: "src/redactionAudit.ts / lib/reasoners/audit.ts" },
                { t: "Verification", d: "Recruiter-email domain against public catalog evidence. v1 is deterministic. A later model path can refine needs_review, but it cannot publish a failed verification. The mailbox never reaches this stage.", m: "lib/reasoners/verify.ts" },
                { t: "Matching", d: "Ranking against a role. Without a model, scoring is a weighted sum of the four components, computed from the same depth and recency constants.", m: "src/matchRecords.ts / lib/reasoners/match.ts" },
                { t: "Brief prose", d: "The narrative. The provenance ledger underneath it — known, inferred, unknown — is a deterministic read of the record either way, so a model-written brief carries the same accounting.", m: "src/interviewBrief.ts / lib/reasoners/brief.ts" },
              ].map((item) => (
                <div key={item.t} className="card-flat stack-2" style={{ borderStyle: "dashed" }}>
                  <div className="row-between" style={{ gap: 12 }}>
                    <span className="label-ink">{item.t}</span>
                    <span className="chip chip-warn">Judgement</span>
                  </div>
                  <p className="body-sm">{item.d}</p>
                  <span className="mono-sm" style={{ color: "var(--muted)", fontSize: 10 }}>{item.m}</span>
                </div>
              ))}
            </div>

            <div className="card stack-2">
              <Label>This deployment</Label>
              <p className="body-sm">
                {engine === "model"
                  ? "A model provider is configured, so the judgement stages above are model-backed."
                  : "No model provider is configured, so the judgement stages above are running on the rule-based reasoners and every result is labelled accordingly."}
              </p>
              <p className="body-sm">
                {capabilities.persistence
                  ? "Supabase is configured, so records persist and row-level security applies to every read."
                  : "Supabase is not configured, so records are held in memory for this session. The interface, cohort query and intro invariant are the same."}
              </p>
              <div className="row-wrap">
                <span className="chip">{persistenceLabel(capabilities.persistence)}</span>
              </div>
            </div>
          </div>
        </div>

        <section className="stack-6" style={{ paddingTop: 40, borderTop: "1px solid var(--border)" }}>
          <div className="stack-3">
            <Label>Privacy is a schema</Label>
            <h2 className="display-md" style={{ maxWidth: "34ch" }}>
              A recruiter query cannot return an unreleased identity
            </h2>
            <p className="body-text" style={{ maxWidth: "72ch" }}>
              Not &ldquo;the interface hides it&rdquo;. Three separate mechanisms, none of which depend on
              application code being correct.
            </p>
          </div>

          <div className="cols-3">
            {[
              {
                t: "processes",
                d: "Holds the raw submission. Owner-only select policy; no policy at all for recruiters, and RLS enabled with no matching policy denies by default. It never needs to be joined for anything recruiter-facing.",
              },
              {
                t: "dossiers",
                d: "What recruiters browse. A whitelisted projection with no identity column by construction, selectable only once redaction_decision = 'publish'.",
              },
              {
                t: "intro_requests",
                d: "The only path to an identity. revealed_identity stays null until approval, and a CHECK constraint makes a non-null value on a non-approved row impossible even for a buggy service-role writer.",
              },
            ].map((item) => (
              <div key={item.t} className="stack-2">
                <span className="mono-sm" style={{ fontWeight: 500 }}>{item.t}</span>
                <p className="body-sm">{item.d}</p>
              </div>
            ))}
          </div>

          <section className="stack-4" style={{ paddingTop: 24 }}>
            <Label>Recruiter email is a credential, not identity</Label>
            <p className="body-text" style={{ maxWidth: "72ch" }}>
              The address is how Elestar resolves a company domain and compares the submitted loop
              to public recruiting evidence. It is never a public identifier: it lives owner-only on
              <span className="mono-sm"> processes</span>, is stripped before the verify reasoner
              runs, and is asserted absent from the Circuit, search, brief, and every SSE frame.
            </p>
            <div className="split" style={{ gap: 24 }}>
              <div className="card-flat stack-2">
                <span className="chip chip-ok">Deterministic</span>
                <p className="body-sm">
                  Parsing the mailbox, rejecting personal providers, extracting the domain, catalog
                  lookup, and <span className="mono-sm">assertNoRecruiterEmail</span> at publish
                  boundaries. v1 verification itself is also a rule table.
                </p>
                <span className="mono-sm" style={{ color: "var(--muted)", fontSize: 10 }}>lib/verify/email.ts · lib/reasoners/verify.ts</span>
              </div>
              <div className="card-flat stack-2" style={{ borderStyle: "dashed" }}>
                <span className="chip chip-warn">Judgement</span>
                <p className="body-sm">
                  Matching company, role and process against public evidence. A later model path may
                  refine <span className="mono-sm">needs_review</span>, but it cannot bypass
                  <span className="mono-sm">failed</span> — verification is a gate.
                </p>
                <span className="mono-sm" style={{ color: "var(--muted)", fontSize: 10 }}>lib/reasoners/verify.ts</span>
              </div>
            </div>
          </section>

          <div className="row-wrap">
            <Link href="/list" className="btn-primary btn-sm" style={{ textDecoration: "none" }}>
              Run the pipeline
            </Link>
            <a href="/api/status" className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
              Machine-readable status
            </a>
          </div>
        </section>
      </div>

      <SystemModel />
    </>
  );
}
