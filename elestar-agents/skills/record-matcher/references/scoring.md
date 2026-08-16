# Scoring detail

## Depth weights

| Depth | Weight | Meaning |
|---|---|---|
| assessed | 1.0 | A whole round or work sample was dedicated to it |
| probed | 0.5 | A substantial portion of a round |
| mentioned | 0.15 | Came up in conversation |

## Competency overlap

For each competency the role requires, find the best match in the record,
allowing semantic equivalence ("Golang" ~ "Go", "on-call" ~ "incident response",
"SQL optimisation" ~ "query performance"). Score = sum of depth weights of matched
competencies / count of required competencies, capped at 1.0.

Requiring nine competencies and matching four is 0.44, not 1.0 because four is
"enough." Recruiters over-list requirements; that is their problem to fix in the
req, and inflating the denominator's forgiveness hides it from them.

## Process similarity

Did this loop test the *shape* of work this role involves? A case-interview loop
and a take-home loop can both assess product judgement, but they assess different
things about it. Score 0-1 on:

- format overlap (system design, case, work sample, pairing, portfolio)
- scope overlap (IC vs lead, greenfield vs maintenance)
- domain adjacency (payments -> fintech is near; payments -> adtech is far)

## Recency decay

| Age of process | Multiplier |
|---|---|
| < 3 months | 1.0 |
| 3-6 months | 0.9 |
| 6-12 months | 0.75 |
| > 12 months | 0.5 |

A twelve-month-old assessment is still an assessment - it is simply about a
person who has changed since. Do not zero it out.

## What is deliberately not in the score

Employer prestige. School. Years of experience. Tenure length. Each of them
correlates with outcomes badly enough to be a liability, and each of them is
already available on LinkedIn, which is not the product.
