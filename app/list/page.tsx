import { PipelineRunner } from "../../components/PipelineRunner";
import { Label, SectionHead } from "../../components/primitives";
import { engineLabel, getCapabilities, persistenceLabel, reasoningEngine } from "../../lib/capabilities";
import { K_FLOOR } from "../../src/redactionAudit";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "List a process — Elestar",
  description: "Watch an interview process become an anonymous, verified record.",
};

/**
 * The listing flow, which is also the demo. There is no separate demo mode with
 * separate logic — this page runs the pipeline the product runs.
 */
export default function ListPage() {
  const capabilities = getCapabilities();
  const engine = reasoningEngine();

  return (
    <div className="wrap section">
      <SectionHead
        kicker="List a process"
        title="Turn an interview loop into evidence"
        sub="Describe a process in your own words. Elestar redacts it, structures it into rounds and competencies, applies the tier rules, audits it for re-identification risk, and publishes it only if it clears the floor."
      />

      <div
        className="card-flat stack-3"
        style={{ marginBottom: 40, borderStyle: engine === "deterministic" ? "dashed" : "solid" }}
      >
        <div className="row-wrap">
          <span className={`engine-badge engine-${engine}`}>{engineLabel(engine)}</span>
          <span className="chip">{persistenceLabel(capabilities.persistence)}</span>
          <span className="chip">k floor = {K_FLOOR}</span>
        </div>

        {engine === "deterministic" ? (
          <p className="body-sm" style={{ maxWidth: "80ch" }}>
            No model provider is configured, so the two judgement stages — structuring and the
            re-identification risk read — run on transparent rule-based reasoners instead. Each of them
            shows the exact rules that fired. Everything else on this page is the product&rsquo;s real
            logic and is unaffected: redaction, the tier ladder, the k={K_FLOOR} cohort floor and the
            fail-closed publish gate all behave identically either way.
          </p>
        ) : (
          <p className="body-sm" style={{ maxWidth: "80ch" }}>
            A model provider is configured, so structuring and the re-identification risk read run
            against it. Schema validation, the tier ladder, the k={K_FLOOR} floor and the fail-closed
            publish gate still sit on top of whatever it returns — the model proposes, a rule disposes.
          </p>
        )}

        {!capabilities.persistence && (
          <p className="body-sm" style={{ maxWidth: "80ch", fontSize: 12 }}>
            Records are held in memory for this session rather than in Supabase, so they will not survive
            a server restart. The same interface, cohort query and intro-approval invariant apply.
          </p>
        )}
      </div>

      <PipelineRunner />

      <section className="stack-4" style={{ marginTop: 72, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
        <Label>What the pipeline refuses to do</Label>
        <div className="cols-3">
          {[
            {
              t: "Invent a round",
              d: "A vague quantifier emits the lower bound and drops confidence below 0.6, which caps the tier and routes the record to review. Ambiguity produces a question, not a guess.",
            },
            {
              t: "Infer an outcome",
              d: "A rejection says the process ended, not why. The only negative-reading outcome requires the candidate to have stated it themselves.",
            },
            {
              t: "Publish on a maybe",
              d: `Below k=${K_FLOOR} cohort peers, or above the risk threshold, and the record is generalised or withheld. Every failure path ends somewhere other than the public pool.`,
            },
          ].map((item) => (
            <div key={item.t} className="stack-2">
              <span className="label-ink">{item.t}</span>
              <p className="body-sm">{item.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
