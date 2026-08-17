# Tier and evidence rules

Two independent axes. A record can be Apex and self-attested, or Standard and
confirmed. Never collapse them into a single score - the whole credibility model
depends on a recruiter being able to set a floor on each.

## Axis 1 - Tier (how hard the process was)

Computed from rounds cleared, the employer's offer rate for that role family, and
loop length. Deterministic. Implemented in `src/parseProcess.ts::computeTier`.

| Tier | Rounds | Offer rate | Loop length | Typically |
|---|---|---|---|---|
| Apex | 6+ | <2% | 6-10 weeks | Multi-panel loop, work sample, executive review |
| Elite | 4-5 | 2-8% | 3-6 weeks | Full technical or case loop plus final panel |
| Verified | 3 | 8-20% | 2-3 weeks | Screen, skills round, hiring manager |
| Standard | 2 | >20% | <2 weeks | Recruiter screen plus one substantive conversation |

Resolution when the three inputs disagree:

1. Rounds cleared is the primary signal.
2. Offer rate may promote by at most one tier, and only when it is a known figure
   for that employer and role family - never a guess.
3. Loop length may never promote. It may demote by one tier when a claimed 6-round
   loop resolved in under two weeks, which is usually a miscount.
4. `roundsConfidence < 0.6` caps the record at Verified regardless of everything
   else.

Brand never promotes. A famous logo with one screening call is Standard. This is
the rule most likely to get quietly eroded by a well-meaning PR, so it is stated
here and asserted in `evals/`.

## Axis 2 - Evidence (how sure we are)

| Level | Source | What it proves |
|---|---|---|
| `self_attested` | The candidate's own account | The process as described. Nothing checked. |
| `corroborated` | Connected calendar or inbox | Interviews occurred, with those people, on those dates. |
| `confirmed` | The original employer replied | The company confirms the stage reached. |
| `flagged` | Pattern review | Something does not reconcile. Held from search pending human review. |

Evidence never moves up automatically from a model output. `corroborated`
requires an OAuth connection with matching events; `confirmed` requires a real
reply. The parser only ever emits `self_attested` or `flagged`.
