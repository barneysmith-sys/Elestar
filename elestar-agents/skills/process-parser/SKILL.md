---
name: process-parser
description: Turn a candidate's freeform description of an interview process into a structured, schema-valid Process record with a proposed clearance tier and evidence level. Use this whenever working on listing flow, candidate onboarding, the /candidate/list route, tier assignment, parsing interview descriptions, or anything that converts what a candidate wrote into a Dossier. Also use when reviewing or changing tier logic.
---

# Process Parser

The first thing a candidate ever does on elestar. They write two messy paragraphs
about a loop they went through; this agent returns a structured record.

If this is slow, wrong, or feels like a form, nobody lists anything and there is
no marketplace. Treat parse quality as the top product metric, not an
implementation detail.

## What it does

Input: freeform text (any length, any structure), optionally plus the candidate's
answers to earlier clarifying questions.

Output: a `ParsedProcess` object conforming to `schemas/parsed-process.schema.json`,
containing rounds, stage reached, format per round, competencies tested, outcome
category, a proposed tier, a confidence score, and up to three clarifying
questions.

## The hard rule: never invent a round

The single failure mode that kills this product is a record claiming more than
happened. A candidate who exaggerates is one bad record. A parser that
systematically rounds up is a pool nobody can trust, and the damage is invisible
because it looks like normal variance.

Concretely:

- A "chat with the hiring manager" is a round. A recruiter screen is a round. A
  scheduling call is not. A take-home is a round. A rejection call is not.
- "I did a few technical interviews" is **not** three rounds. It is an unknown
  number, and it produces a clarifying question.
- If the candidate never states an outcome, `outcome` is `unstated`, not
  `no_offer`.
- If total rounds are ambiguous, emit the **lower** bound and set
  `roundsConfidence` below 0.6, which routes the record to self-attested and
  suppresses tier promotion.

## Outcome categories

Most finalist rejections are not competence judgements, and the record should say
which kind it was. Map to exactly one of:

- `req_closed` - headcount pulled, budget frozen, role cancelled
- `internal_candidate` - filled internally or by a referral already in flight
- `comp_mismatch` - agreement on fit, disagreement on money or level
- `competitive_loss` - another candidate was preferred
- `candidate_withdrew` - the candidate stopped the process
- `performance` - the company judged the candidate below bar
- `unstated` - the candidate did not say

Do not infer `performance` from silence. It is the only category that reads as a
negative signal, so it requires the candidate to have actually said it.

## Competencies

Emit 3-8 competencies, each a short noun phrase drawn from what was *tested*, not
what was *listed on a job description*. "System design" counts if there was a
system design interview. It does not count because the role was senior backend.

Each competency carries a `depth`:

- `mentioned` - came up in conversation
- `probed` - a substantial portion of a round was spent on it
- `assessed` - a whole round or a work sample was dedicated to it

Depth is what makes the interview brief useful downstream. A recruiter skipping a
round needs to know the difference between "we talked about Kubernetes" and "we
gave them a broken cluster."

## Tier proposal

Compute per `references/tier-rules.md`. The model proposes; the deterministic
function in `src/parseProcess.ts` is authoritative and may lower but never raise
the proposal. If the model and the rules disagree by more than one tier, set
`needsReview: true`.

## Clarifying questions

Return at most three, only when they would change the tier or the round count.
Write them the way a person would ask - short, specific, answerable in a few
words. Never ask for anything identifying.

Good: "How many technical rounds were there in total - two or three?"
Good: "Was the take-home reviewed in a follow-up call, or just graded?"
Bad: "Can you provide additional details about your interview experience?"
Bad: "Which company was this?" (the app asks that separately, and it is stored
     separately from the model's view)

## What this agent must never receive

Names, email addresses, phone numbers, the candidate's current employer, or any
free text the candidate wrote into an identity field. `src/redact.ts` runs first.
If you are adding a new input to this agent, run it through redaction or explain
in the PR why it cannot carry an identity.

## References

- `references/tier-rules.md` - the deterministic tier and evidence tables
- `references/parsing-examples.md` - worked examples including the hard cases
