---
name: record-matcher
description: Rank anonymized elestar records against a role description by competency overlap, returning a fit score and a written rationale for each. Use whenever working on recruiter search, the /recruiter/search route, ranking, fit scores, clearance floors, saved searches, or turning a job description into a shortlist. Also use when tuning why a given candidate did or did not surface.
---

# Record Matcher

What a recruiter is paying for. A recruiter describes a role in a sentence or
pastes a job description; this returns a short ranked list with a reason attached
to every row.

## The thesis: overlap, not keywords

A keyword search returns candidates whose records happen to use your vocabulary.
This ranks by whether the competencies *already assessed* overlap with the
competencies this role *actually requires*.

Someone who cleared a payments infrastructure loop should surface for a payments
infrastructure req even if the two descriptions share no terminology. Someone
whose record says "Kubernetes" because it came up once should not outrank someone
who was handed a broken cluster, even though the keyword match is identical.

Depth from the parser (`mentioned` / `probed` / `assessed`) is the input that
makes this possible. Weight it: `assessed` = 1.0, `probed` = 0.5,
`mentioned` = 0.15.

## Hard filters run before the model, never inside it

The recruiter's floor is a database constraint, not a prompt instruction. Tier
floor, evidence floor, location, notice period and candidate blocklists are all
applied in SQL. The model only ever sees records that already qualify.

Two reasons. It is cheaper. And a model that can be talked into returning a
below-floor record is a model that can be talked into returning a blocked
employer's record, which is a privacy incident rather than a ranking bug.

## Fit score

0-100, and it must mean something stable enough that a recruiter learns to read
it. Composition:

- 55% competency overlap, depth-weighted
- 20% process similarity - a loop that tested this shape of work
- 15% seniority and scope alignment
- 10% recency of the process

Do not return more than 20 results. The value proposition is a list short enough
to read; a hundred rows is a job board with extra steps.

## Rationale

One or two sentences per record, written for the recruiter but readable by the
candidate. Every claim must be traceable to a field in the record.

Good: "Assessed on distributed systems and on-call judgement in a five-round
fintech loop - both are the core of this req. No exposure to your payments
domain."
Bad: "Strong candidate, great fit for this role."

Always name the gap. A rationale with no negative is a sales pitch, and it trains
recruiters to stop reading rationales.

## Ranking integrity

- Never rank by employer prestige. Not as a tiebreak, not as a feature.
- Never let a candidate influence their own ranking. If a paid boost is ever
  proposed, it invalidates every score on the page.
- Ties break on evidence level, then on recency. Both are defensible to a
  candidate who asks why they placed where they did.
