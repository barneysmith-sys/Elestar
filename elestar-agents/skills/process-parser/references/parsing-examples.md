# Parsing examples

Real shapes of input, and the calls that are easy to get wrong.

## 1. Clean case

> I interviewed at a Series B fintech, maybe 300 people, for a senior backend
> role. Recruiter screen, then a coding round in Go, then a system design
> session, then a take-home on rate limiting which we reviewed in a follow-up,
> then a final panel with two engineers and the VP. Took about five weeks. They
> went with someone internal in the end.

rounds: 5 (screen, coding, system design, take-home review, final panel)
Note the take-home plus its review call is **one** round, not two - the artifact
and the discussion of the artifact are a single assessment.
outcome: `internal_candidate`
competencies: Go (assessed), system design (assessed), rate limiting (assessed),
distributed systems (probed), communication (mentioned)
tier proposal: Elite. roundsConfidence: 0.95

## 2. Ambiguous count -> clarifying question

> Had a bunch of technical rounds at a big cloud company, got to the last stage,
> didn't get it.

rounds: 2 (lower bound - "a bunch" is at least two)
roundsConfidence: 0.3 -> caps at Verified
outcome: `unstated` (not `performance` - "didn't get it" says nothing about why)
questions: ["How many technical rounds were there in total?", "Was the last stage
a panel, or a conversation with the hiring manager?"]

The temptation is to read "big cloud company" plus "last stage" as Apex. Resist
it. Brand does not promote and neither does the phrase "last stage."

## 3. The inflation shape

> Basically made it to the final round at Google - I did the recruiter call and
> they told me they were moving me forward to the onsite.

rounds: 1. Being told you will be moved forward is not clearing a round.
tier: Standard. needsReview: false - this is not dishonest, it is a common and
sincere misunderstanding of what "reached" means, and the record is simply small.

The UI copy matters here more than the model does: the listing flow should say
"rounds you completed" rather than "how far you got."

## 4. Withdrawal, not rejection

> Got through four rounds at a payments company then took another offer.

outcome: `candidate_withdrew`. Tier still computes normally on four rounds -
withdrawing does not reduce what was demonstrated. Do not treat withdrawal as a
negative signal anywhere downstream.

## 5. Contract and internal moves

> I did three interviews for an internal transfer.

Internal transfer loops are not comparable to external ones and offer rates are
wildly different. Set `processType: "internal"` and let the recruiter filter.
Do not compute an external tier for it.
