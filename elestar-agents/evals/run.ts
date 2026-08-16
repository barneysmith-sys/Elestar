/**
 * Minimal eval runner. `npx tsx evals/run.ts`
 *
 * This is not a scoring harness — it is a regression check on the assertions
 * that actually matter. Every one of these encodes a rule that will otherwise
 * get quietly eroded by a well-meaning prompt tweak.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseProcess, computeTier } from "../src/parseProcess";
import { redact } from "../src/redact";

const ORDER = ["standard", "verified", "elite", "apex"];
let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else    { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

// ---- unit: deterministic tier rules (no API calls) -------------------------
console.log("\ncomputeTier");
check("6 rounds -> apex",
  computeTier({ roundsCleared: 6, roundsConfidence: 1, loopLengthWeeks: 8, knownOfferRate: null }) === "apex");
check("low confidence caps at verified",
  computeTier({ roundsCleared: 6, roundsConfidence: 0.4, loopLengthWeeks: 8, knownOfferRate: null }) === "verified");
check("offer rate promotes at most one step",
  ORDER.indexOf(computeTier({ roundsCleared: 3, roundsConfidence: 1, loopLengthWeeks: 3, knownOfferRate: 0.001 }))
    <= ORDER.indexOf("elite"));
check("6 rounds in under 2 weeks demotes",
  computeTier({ roundsCleared: 6, roundsConfidence: 1, loopLengthWeeks: 1, knownOfferRate: null }) === "elite");

// ---- unit: redaction ------------------------------------------------------
console.log("\nredact");
const r = redact("I'm Jane Okafor, jane@example.com, +44 7700 900123, linkedin.com/in/jane", {
  knownNames: ["Jane Okafor"],
});
check("email removed", !r.text.includes("jane@example.com"));
check("phone removed", !/\d{6}/.test(r.text));
check("known name removed", !r.text.toLowerCase().includes("okafor"));

// ---- integration: parser (requires ANTHROPIC_API_KEY) ---------------------
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("\nparseProcess  SKIPPED (no ANTHROPIC_API_KEY)");
} else {
  const cases = JSON.parse(
    readFileSync(join(__dirname, "fixtures/parse-cases.json"), "utf8"),
  ) as any[];

  console.log("\nparseProcess");
  for (const c of cases) {
    try {
      const out = await parseProcess({ description: c.description, knownNames: ["Jane Okafor"] });
      const e = c.expect;
      if (e.roundsCleared !== undefined)
        check(`${c.id}: rounds`, out.roundsCleared === e.roundsCleared, `got ${out.roundsCleared}`);
      if (e.roundsClearedMax !== undefined)
        check(`${c.id}: rounds <= ${e.roundsClearedMax}`, out.roundsCleared <= e.roundsClearedMax, `got ${out.roundsCleared}`);
      if (e.mustNotExceedRounds !== undefined)
        check(`${c.id}: no invented rounds`, out.roundsCleared <= e.mustNotExceedRounds, `got ${out.roundsCleared}`);
      if (e.outcome !== undefined)
        check(`${c.id}: outcome`, out.outcome === e.outcome, `got ${out.outcome}`);
      if (e.proposedTier !== undefined)
        check(`${c.id}: tier`, out.proposedTier === e.proposedTier, `got ${out.proposedTier}`);
      if (e.tierNotAbove !== undefined)
        check(`${c.id}: tier not above ${e.tierNotAbove}`,
          ORDER.indexOf(out.proposedTier) <= ORDER.indexOf(e.tierNotAbove), `got ${out.proposedTier}`);
      if (e.roundsConfidenceMax !== undefined)
        check(`${c.id}: confidence low`, out.roundsConfidence <= e.roundsConfidenceMax, `got ${out.roundsConfidence}`);
      if (e.roundsConfidenceMin !== undefined)
        check(`${c.id}: confidence high`, out.roundsConfidence >= e.roundsConfidenceMin, `got ${out.roundsConfidence}`);
      if (e.questionsMin !== undefined)
        check(`${c.id}: asks a question`, out.questions.length >= e.questionsMin);
      if (e.processType !== undefined)
        check(`${c.id}: processType`, out.processType === e.processType, `got ${out.processType}`);
      if (e.noIdentityInOutput)
        check(`${c.id}: no identity leaked`, !JSON.stringify(out).toLowerCase().includes("okafor"));
    } catch (err) {
      check(`${c.id}: threw`, false, String(err));
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
