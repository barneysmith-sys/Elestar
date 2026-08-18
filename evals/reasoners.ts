/**
 * Assertions over the deterministic reasoners.
 *
 * These are the paths that run when there is no API key, which in practice
 * means they are the paths a first-time visitor sees. They also encode the
 * rules that matter most — never invent a round, never infer an outcome,
 * never publish below the k floor — so they are worth checking directly
 * rather than only through the UI.
 *
 * Run with: npm run eval:reasoners
 */

import { parseProcessDeterministic } from "../lib/reasoners/parse";
import { auditRedactionDeterministic } from "../lib/reasoners/audit";
import { matchRecordsDeterministic } from "../lib/reasoners/match";
import { buildInterviewBriefDeterministic } from "../lib/reasoners/brief";
import { verifyProcessDeterministic } from "../lib/reasoners/verify";
import { assertNoRecruiterEmail, parseRecruiterSignal } from "../lib/verify/email";
import { parseForwardedMail } from "../lib/verify/forwardedMail";
import {
  CANONICAL_FORWARDS,
  GMAIL_FORWARDS,
  HEALTHTECH_FORWARDS,
} from "../lib/verify/mailFixtures";
import { redact } from "../src/redact";
import { computeTier } from "../src/parseProcess";
import { K_FLOOR } from "../src/redactionAudit";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  checks++;
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}`);
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
const CANONICAL =
  "Senior Backend Engineer at a Series B fintech. Recruiter screen. Technical interview. " +
  "System design. Final panel. Candidate was rejected after the final round.";

section("parse: the canonical demo input");
{
  const { parsed, trace } = parseProcessDeterministic({ description: CANONICAL });

  check("finds 4 rounds, not 5 — 'final panel' is one round", parsed.rounds.length === 4, parsed.rounds);
  check(
    "round types are screen/technical/system_design/final",
    JSON.stringify(parsed.rounds.map((r) => r.type)) ===
      JSON.stringify(["screen", "technical", "system_design", "final"]),
    parsed.rounds.map((r) => r.type),
  );
  check("3 of 4 rounds cleared — reaching the final means earlier ones passed", parsed.roundsCleared === 3, parsed.roundsCleared);
  check('outcome stays "unstated" — a rejection is not a reason', parsed.outcome === "unstated", parsed.outcome);
  check("tier is verified (3 cleared)", parsed.proposedTier === "verified", parsed.proposedTier);
  check("sector generalised to fintech", parsed.employerProfile.sector === "fintech", parsed.employerProfile);
  check("stage generalised to series_b", parsed.employerProfile.stage === "series_b", parsed.employerProfile);
  check("no company name retained anywhere", !JSON.stringify(parsed).toLowerCase().includes("fintech.") , parsed.employerProfile);
  check("confidence high enough to publish without review", parsed.roundsConfidence >= 0.6 && !parsed.needsReview, {
    confidence: parsed.roundsConfidence,
    needsReview: parsed.needsReview,
  });
  check("asks no clarifying questions for a well-formed input", parsed.questions.length === 0, parsed.questions);
  check("emits a rule trace", trace.length > 0);
  check("competencies derived, 3..8 of them", parsed.competencies.length >= 3 && parsed.competencies.length <= 8, parsed.competencies);
  check("is deterministic across runs", JSON.stringify(parseProcessDeterministic({ description: CANONICAL }).parsed) === JSON.stringify(parsed));
}

section("parse: never invent a round");
{
  const vague = parseProcessDeterministic({
    description: "I had a recruiter screen then a few technical interviews at a Series A healthtech company.",
  });
  check("vague quantifier drops confidence below 0.6", vague.parsed.roundsConfidence < 0.6, vague.parsed.roundsConfidence);
  check("vague quantifier forces human review", vague.parsed.needsReview, vague.parsed);
  check("asks a clarifying question instead of guessing", vague.parsed.questions.length > 0, vague.parsed.questions);
  check("tier capped at verified by low confidence", vague.parsed.proposedTier === "verified" || vague.parsed.proposedTier === "standard", vague.parsed.proposedTier);

  const nonRounds = parseProcessDeterministic({
    description: "Recruiter screen, then a scheduling call, then a technical interview, then a rejection call.",
  });
  check("scheduling and rejection calls are not rounds", nonRounds.parsed.rounds.length === 2, nonRounds.parsed.rounds);

  const takeHome = parseProcessDeterministic({
    description: "Recruiter screen, a take-home, then a call reviewing the take-home with an engineer.",
  });
  check("take-home and its review call are one round", takeHome.parsed.rounds.length === 2, takeHome.parsed.rounds);
}

section("parse: outcome is never inferred");
{
  const cases: [string, string][] = [
    ["Recruiter screen and a technical. They said the req was closed.", "req_closed"],
    ["Screen, technical, panel. They went with an internal candidate.", "internal_candidate"],
    ["Screen and technical. Comp mismatch, they couldn't match my number.", "comp_mismatch"],
    ["Screen, technical, final round. I withdrew.", "candidate_withdrew"],
    ["Screen, technical, panel. Rejected.", "unstated"],
    ["Screen then a technical interview.", "unstated"],
  ];
  for (const [text, expected] of cases) {
    const got = parseProcessDeterministic({ description: text }).parsed.outcome;
    check(`"${text.slice(0, 44)}…" -> ${expected}`, got === expected, got);
  }
}

section("parse: clarification answers actually resolve the question");
{
  const first = parseProcessDeterministic({
    description: "Recruiter screen then several technical rounds at a Series B fintech.",
  });
  check("first pass asks a question", first.parsed.questions.length > 0, first.parsed.questions);

  const question = first.parsed.questions[0]!;
  const partly = parseProcessDeterministic({
    description: "Recruiter screen then several technical rounds at a Series B fintech.",
    priorAnswers: { [question]: "4 rounds in total" },
  });
  check("the same question is not asked twice", !partly.parsed.questions.includes(question), partly.parsed.questions);

  // This input is ambiguous twice over: how many rounds, and how far the
  // candidate got. Answering only the first must not clear review — a resolved
  // count does not tell us where the process ended.
  check(
    "answering one of two ambiguities still holds the record",
    partly.parsed.needsReview,
    { confidence: partly.parsed.roundsConfidence, questions: partly.parsed.questions },
  );

  // The point of asking is to get answers that change the outcome. If a fully
  // answered submission were still pinned below the review threshold, the
  // clarification loop would be theatre.
  const answered: Record<string, string> = {};
  for (const q of first.parsed.questions) {
    answered[q] = /how many/i.test(q) ? "4 rounds in total" : "the last one was the system design round";
  }
  const second = parseProcessDeterministic({
    description: "Recruiter screen then several technical rounds at a Series B fintech.",
    priorAnswers: answered,
  });
  check("a fully answered submission asks nothing further", second.parsed.questions.length === 0, second.parsed.questions);
  check(
    "answered ambiguities lift confidence above the review threshold",
    second.parsed.roundsConfidence >= 0.6,
    { before: first.parsed.roundsConfidence, after: second.parsed.roundsConfidence },
  );
  check("answered ambiguities clear human review", !second.parsed.needsReview, second.parsed);
  check("the answered total is the one recorded", second.parsed.roundsTotal === 4, second.parsed.roundsTotal);

  check(
    "rounds it cannot name are still not invented",
    second.parsed.rounds.length < (second.parsed.roundsTotal ?? 0),
    second.parsed.rounds.map((r) => r.type),
  );
}

section("parse: a stated ending is not a stated stage");
{
  // "They went with another candidate" says the loop ran to a decision without
  // an offer. That is a fact about how far the process got, so it should not
  // trigger a clarifying question — but it must not be read as a performance
  // outcome either.
  const lost = parseProcessDeterministic({
    description:
      "Recruiter screen, take-home, technical interview, system design, panel, and a final round at a Series B fintech. They went with another candidate.",
  });
  check("no clarifying question when the ending is stated", lost.parsed.questions.length === 0, lost.parsed.questions);
  check("the decision round is not counted as cleared", lost.parsed.roundsCleared === lost.parsed.rounds.length - 1, {
    cleared: lost.parsed.roundsCleared,
    named: lost.parsed.rounds.length,
  });
  check("the stated reason is kept verbatim as the outcome", lost.parsed.outcome === "competitive_loss", lost.parsed.outcome);
  check("a competitive loss reaches the privacy audit", !lost.parsed.needsReview, lost.parsed.needsReview);

  const silent = parseProcessDeterministic({
    description: "Recruiter screen, technical interview, and a system design round at a Series B fintech.",
  });
  check("silence about the ending still asks", silent.parsed.questions.length > 0, silent.parsed.questions);
}

section("redact: identity never reaches a model");
{
  const r = redact(
    "Reach me at ada@example.com or +1 (415) 555-0199, portfolio https://ada.example.com, im @adalovelace",
    { knownNames: ["Ada Lovelace"] },
  );
  check("email removed", !r.text.includes("ada@example.com"), r.text);
  check("phone removed", !r.text.includes("555-0199"), r.text);
  check("url removed", !r.text.includes("ada.example.com"), r.text);
  check("handle removed", !r.text.includes("@adalovelace"), r.text);
  check("reports spans for the UI", r.spans.length >= 4, r.spans);
  check("spans point at the original text", r.spans.every((s) => s.end > s.start));
  check("spans do not overlap", r.spans.every((s, i) => i === 0 || s.start >= r.spans[i - 1]!.end), r.spans);
}

section("audit: the k floor is a hard rule");
{
  const { parsed } = parseProcessDeterministic({ description: CANONICAL });

  const belowFloor = auditRedactionDeterministic({ record: parsed, poolCohortCount: K_FLOOR - 1 });
  check(
    `cohort of ${K_FLOOR - 1} never publishes`,
    belowFloor.audit.decision !== "publish",
    belowFloor.audit.decision,
  );
  check("below-floor records get generalisation proposals", belowFloor.audit.generalizations.length > 0, belowFloor.audit.generalizations);

  const atFloor = auditRedactionDeterministic({ record: parsed, poolCohortCount: K_FLOOR });
  check(`cohort of ${K_FLOOR} at low risk publishes`, atFloor.audit.decision === "publish", atFloor.audit);
  check("reports the measured cohort as k", atFloor.audit.kAnonymity === K_FLOOR, atFloor.audit.kAnonymity);

  const tiny = parseProcessDeterministic({
    description:
      "Recruiter screen, take-home, technical interview, system design, panel, and a final round at a 30 person seed stage crypto company in London over 8 weeks. They went with another candidate.",
  });
  const risky = auditRedactionDeterministic({ record: tiny.parsed, poolCohortCount: 50 });
  check(
    "a highly specific small-company record does not publish even with a large cohort",
    risky.audit.decision !== "publish",
    { decision: risky.audit.decision, risk: risky.audit.riskScore },
  );
  check("risk score stays within 0..100", risky.audit.riskScore >= 0 && risky.audit.riskScore <= 100, risky.audit.riskScore);
}

section("tier: deterministic rules, brand is not an input");
{
  check("6 cleared -> apex", computeTier({ roundsCleared: 6, roundsConfidence: 0.9, loopLengthWeeks: 8, knownOfferRate: null }) === "apex");
  check("4 cleared -> elite", computeTier({ roundsCleared: 4, roundsConfidence: 0.9, loopLengthWeeks: 4, knownOfferRate: null }) === "elite");
  check("3 cleared -> verified", computeTier({ roundsCleared: 3, roundsConfidence: 0.9, loopLengthWeeks: 4, knownOfferRate: null }) === "verified");
  check("2 cleared -> standard", computeTier({ roundsCleared: 2, roundsConfidence: 0.9, loopLengthWeeks: 2, knownOfferRate: null }) === "standard");
  check(
    "low confidence caps at verified",
    computeTier({ roundsCleared: 6, roundsConfidence: 0.4, loopLengthWeeks: 8, knownOfferRate: null }) === "verified",
  );
  check(
    "a 6-round loop in under 2 weeks is demoted as a likely miscount",
    computeTier({ roundsCleared: 6, roundsConfidence: 0.9, loopLengthWeeks: 1, knownOfferRate: null }) === "elite",
  );
}

section("match: explainable scoring, always a gap");
{
  const a = parseProcessDeterministic({ description: CANONICAL }).parsed;
  const b = parseProcessDeterministic({
    description: "Recruiter screen and a technical interview at a Series A edtech company. Rejected.",
  }).parsed;

  const { results, trace } = matchRecordsDeterministic({
    roleDescription: "Senior backend engineer, distributed systems and system design, Series B fintech",
    candidates: [
      { recordId: "A-0001", record: a, monthsAgo: 1 },
      { recordId: "A-0002", record: b, monthsAgo: 20 },
    ],
  });

  check("returns both records", results.length === 2, results.length);
  check("the system-design record ranks first", results[0]?.recordId === "A-0001", results.map((r) => r.recordId));
  check("scores are 0..100", results.every((r) => r.fitScore >= 0 && r.fitScore <= 100), results.map((r) => r.fitScore));
  check("every result names at least one gap", results.every((r) => r.gaps.length > 0), results.map((r) => r.gaps.length));
  check("components are 0..1", results.every((r) => Object.values(r.components).every((v) => v >= 0 && v <= 1)));
  check("old evidence is discounted by recency", (results.find((r) => r.recordId === "A-0002")?.components.recency ?? 1) < 1);
  check("emits a scoring trace", trace.length > 0);
  check("ranking is stable across runs", JSON.stringify(matchRecordsDeterministic({
    roleDescription: "Senior backend engineer, distributed systems and system design, Series B fintech",
    candidates: [
      { recordId: "A-0001", record: a, monthsAgo: 1 },
      { recordId: "A-0002", record: b, monthsAgo: 20 },
    ],
  }).results) === JSON.stringify(results));
}

section("brief: known vs inferred vs unknown");
{
  const record = parseProcessDeterministic({ description: CANONICAL }).parsed;
  const brief = buildInterviewBriefDeterministic({
    record,
    roleDescription: "Senior backend engineer, distributed systems, on-call reliability, leadership",
    hiringLoop: ["Recruiter screen", "Coding interview", "System design", "Team panel", "Final"],
  });

  check("every fact carries a provenance", brief.facts.every((f) => ["known", "inferred", "unknown"].includes(f.provenance)), brief.facts.length);
  check("every fact carries a basis", brief.facts.every((f) => f.basis.length > 0));
  check("has at least one KNOWN fact", brief.facts.some((f) => f.provenance === "known"));
  check("names the unstated outcome as UNKNOWN, not a negative", brief.facts.some((f) => f.provenance === "unknown" && /why this process ended|process ended/i.test(f.claim)), brief.facts.filter((f) => f.provenance === "unknown"));
  check("outcome context refuses to infer performance", /does not say why/i.test(brief.outcomeContext), brief.outcomeContext);
  check("never recommends skipping more than half the loop", brief.safeToSkip.length <= Math.floor(5 / 2), brief.safeToSkip);
  check("always says what to probe", brief.probeInstead.length > 0, brief.probeInstead);
  check("always says what never to skip", brief.neverSkip.length > 0, brief.neverSkip);
  check("flags self-attested evidence as needing verification", brief.neverSkip.some((s) => /self-attested/i.test(s)), brief.neverSkip);
  check("confidence is 0..1", brief.confidence >= 0 && brief.confidence <= 1, brief.confidence);
  check("explains how confidence was reached", brief.confidenceBasis.length > 0);
  check("only lists assessed or probed competencies as tested", brief.alreadyAssessed.every((a) => a.depth !== "mentioned"), brief.alreadyAssessed);
}

section("verify: recruiter signal");
{
  const company = parseRecruiterSignal("talent@ledgerpay.example");
  check("valid company email extracts domain", company.kind === "company" && company.domain === "ledgerpay.example", company);

  const gmail = parseRecruiterSignal("talent@gmail.com");
  check("gmail is personal and fails", gmail.kind === "personal", gmail);
  const gmailVerify = verifyProcessDeterministic({
    signal: gmail,
    parsed: parseProcessDeterministic({ description: CANONICAL }).parsed,
  });
  check("gmail verification status is failed", gmailVerify.verification.status === "failed", gmailVerify.verification);

  const invalid = parseRecruiterSignal("not-an-email");
  check("invalid email fails", invalid.kind === "invalid", invalid);
  const invalidVerify = verifyProcessDeterministic({
    signal: invalid,
    parsed: parseProcessDeterministic({ description: CANONICAL }).parsed,
  });
  check("invalid verification status is failed", invalidVerify.verification.status === "failed", invalidVerify.verification);

  const parsed = parseProcessDeterministic({ description: CANONICAL }).parsed;
  const ledger = verifyProcessDeterministic({
    signal: parseRecruiterSignal("talent@ledgerpay.example"),
    parsed,
    role: "Senior Backend Engineer",
  });
  check("ledgerpay.example + canonical fintech parse → verified", ledger.verification.status === "verified", ledger.verification);

  const mismatch = verifyProcessDeterministic({
    signal: parseRecruiterSignal("recruiting@harbor-clinic.example"),
    parsed,
    role: "Senior Backend Engineer",
  });
  check(
    "harbor-clinic.example + fintech parse → failed company mismatch",
    mismatch.verification.status === "failed" && mismatch.verification.companyMatch === false,
    mismatch.verification,
  );

  const unknown = verifyProcessDeterministic({
    signal: parseRecruiterSignal("talent@unknown-corp.example"),
    parsed,
    role: "Senior Backend Engineer",
  });
  check("unknown domain → needs_review", unknown.verification.status === "needs_review", unknown.verification);

  const email = "talent@ledgerpay.example";
  const serialised = JSON.stringify(ledger.verification);
  check("verification result JSON never contains the recruiter email", !serialised.toLowerCase().includes(email), serialised);

  let threw = false;
  try {
    assertNoRecruiterEmail({ leak: email }, email);
  } catch {
    threw = true;
  }
  check("assertNoRecruiterEmail throws if payload includes it", threw);
  assertNoRecruiterEmail(ledger.verification, email);
  check("assertNoRecruiterEmail accepts a clean verification payload", true);

  let threwMany = false;
  try {
    assertNoRecruiterEmail({ leak: email }, [email, "other@northwind-health.example"]);
  } catch {
    threwMany = true;
  }
  check("assertNoRecruiterEmail throws against any address in a list", threwMany);
}

section("ingest: forwarded recruiter mail shows how far they got");
{
  const mail = parseForwardedMail(CANONICAL_FORWARDS);
  check("splits a four-message thread", mail.messages.length === 4, mail.messages.length);
  check(
    "round types reached are screen/technical/system_design/final",
    JSON.stringify([...new Set(mail.messages.flatMap((m) => m.signals.map((s) => s.type)))].sort()) ===
      JSON.stringify(["final", "screen", "system_design", "technical"].sort()),
    mail.messages.map((m) => m.signals.map((s) => s.type)),
  );
  check("last round reached is the final", mail.lastReached === "final", mail.lastReachedLabel);
  check("From: domain is ledgerpay.example", mail.primarySignal.domain === "ledgerpay.example", mail.primarySignal);
  check("raw mailbox is held privately", mail.recruiterEmails.includes("talent@ledgerpay.example"));
  check("digest never contains the mailbox", !mail.digest.toLowerCase().includes("talent@ledgerpay.example"), mail.digest);
  check("public messages never contain the mailbox", !JSON.stringify(mail.messages).toLowerCase().includes("talent@ledgerpay.example"));

  const parsedFromMail = parseProcessDeterministic({
    description: `${mail.digest}\n\nSenior Backend Engineer at a Series B fintech.`,
  }).parsed;
  check("mail digest parses to 4 rounds", parsedFromMail.rounds.length === 4, parsedFromMail.rounds);
  check("mail digest clears 3", parsedFromMail.roundsCleared === 3, parsedFromMail.roundsCleared);
  check("mail digest does not invent an outcome", parsedFromMail.outcome === "unstated", parsedFromMail.outcome);

  const vague = parseForwardedMail(HEALTHTECH_FORWARDS);
  check("ambiguous thread still names a screen and a technical", vague.messages.length === 2, vague.messages.length);
  const vagueParse = parseProcessDeterministic({
    description: `${vague.digest}\n\n${HEALTHTECH_FORWARDS}\nSeries A healthtech, maybe 40 people.`,
  }).parsed;
  check("vague forwards still ask rather than guess", vagueParse.questions.length > 0, vagueParse.questions);

  const gmail = parseForwardedMail(GMAIL_FORWARDS);
  check("gmail From: is a personal signal", gmail.primarySignal.kind === "personal", gmail.primarySignal);
}

// ---------------------------------------------------------------------------
console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
