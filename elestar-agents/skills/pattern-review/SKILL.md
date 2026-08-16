---
name: pattern-review
description: Review records for inflation, fabrication and coordinated gaming by reading across the pool, and route suspicious records to human review. Use whenever working on trust, fraud, verification, the /admin/flags queue, evidence levels, or anything about whether records can be believed. Phase two, but read this before designing the Phase one data model because it determines what has to be captured up front.
---

# Pattern Review

A pool of self-reported achievements is an obvious target. The question is not
whether people will inflate, it is whether inflation is detectable, and that is
decided by what the Phase 1 schema records.

Read this before finalising the data model.

## What it does

Runs in batch, not on the write path. Input: a record plus aggregate pool
statistics. Output: `PatternReview` per `schemas/pattern-review.schema.json` -
a list of signals with severity and evidence, and a recommendation of
`clear` / `flag` / `hold`.

## Signals worth detecting

**Internal inconsistency.** Overlapping process date ranges. A loop length that
does not fit the stated round count. A take-home claimed with no gap between the
surrounding rounds.

**Population inconsistency.** The claimed loop does not match how that employer
is known to hire - a six-round loop at a company where forty other records all
show three. This one only works once there are records to compare against, which
is why Phase 1 must capture round *structure* and not just round *count*.

**Trajectory implausibility.** Four Apex-tier finalist runs in eight weeks. Not
impossible. Worth a human look.

**Coordinated listing.** Several accounts created close together listing the same
employer and loop with suspiciously similar phrasing. This is the referral loop's
attack surface, and it is the one that scales.

**Evidence mismatch.** Connected calendar events that do not support the claimed
round count. Highest-confidence signal available, and the reason the OAuth
connection matters more for trust than for convenience.

## Never auto-reject

Every signal produces a queue item for a human, never a deletion. Three reasons.
The false-positive cost is a real candidate wrongly excluded from work.
An unexplained rejection is unappealable and will end up on social media. And a
human queue produces labelled data, which is the only path to the model getting
better at this.

`hold` suppresses a record from search while it waits. It does not notify the
candidate that they are suspected of anything, and it does not tell them which
signal fired - that turns the queue into a tutorial for gaming it.

## Base rates

Most anomalies are honest. People misremember round counts, conflate a screen with
an interview, and describe an ambiguous outcome charitably. Calibrate severity so
that `hold` is rare - if more than about 2% of records are held, the threshold is
wrong and the review queue will be abandoned by whoever has to work it.

## What the model must not do

- Never infer intent. Report the discrepancy, not a theory about the person.
- Never use writing quality, grammar, or fluency as a signal. It is a proxy for
  first language and education, it is not evidence of anything, and it would make
  the trust system quietly discriminatory.
- Never use employer prestige as a prior in either direction.
