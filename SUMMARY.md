# elestar-agents — what this is and why

*For Josh and anyone else picking up the AI layer.*

---

## The short version

We're calling elestar an AI-native hiring platform. The build spec puts every AI
feature in Phase 3, behind OAuth verification and fraud detection. That gap is a
problem: if the positioning says AI-native and the launch product is a form plus a
filtered table, the claim collapses the first time someone uses it.

This package closes the gap. It's the whole agent layer, specified and mostly
implemented, split so that **four of the five agents are cheap enough to ship in
Phase 1** — they're single API calls with no infrastructure behind them. The
expensive one (pattern review) stays in Phase 2 where the spec put it.

There is also one thing in here that isn't in the spec at all and I think has to
be: a **redaction audit** that runs before any record is published. More on that
below, because it's the part I'd most like a second opinion on.

---

## The five agents

| Agent | What it does | Why it matters | Ships |
|---|---|---|---|
| **process-parser** | Candidate's two messy paragraphs -> structured record + proposed tier | If listing feels like a form, nobody lists, and there's no marketplace | Phase 1 |
| **redaction-audit** | Scores a record for re-identification risk before publish | The one failure we can't recover from | Phase 1 |
| **record-matcher** | Role description -> ranked shortlist with rationale | This is literally what recruiters pay for | Phase 1 |
| **interview-brief** | Approved record + role -> what to skip, what to probe | Makes "start at round four" real rather than a slogan | Phase 1 |
| **pattern-review** | Reads across the pool for inflation and gaming | Trust, once there's a pool to read across | Phase 2 |

Each one has a `SKILL.md` (the reasoning and the rules), a prompt template, a
JSON schema, and a TypeScript function. They're independent — you can ship the
parser alone and the rest still slots in later.

---

## Three decisions I made that are worth arguing with

### 1. The employer name is withheld too, not just the candidate's

Our anonymity promise is that a candidate can list without their employer finding
out. Field-level redaction — stripping the name — is the easy half. The hard half
is the combination.

> "Five-round loop, Series B fintech, ~300 people, London, senior backend, went to
> someone internal, three weeks ago"

That contains no name. It identifies exactly one person to anyone who works there.

So `redaction-audit` enforces a **k-anonymity floor of 8**: a record only publishes
if at least 8 other live records share its combination of tier band, function,
seniority band, region and quarter. Below that, it generalizes (date -> quarter,
"~300 people" -> "100-500", city -> country) until it clears, and withholds if it
can't.

**The cost is real.** "Cleared five rounds at Stripe" converts far better than
"cleared five rounds at a payments company," and we're giving that up. My argument
is that in a thin early pool, the employer name plus function plus timing *is* an
identity, and k for a named five-round loop at a 300-person company in one city is
usually 1. If you want to reverse this, that's the number to argue with, not the
conversion rate.

It fails closed: any error, timeout or malformed response returns `withhold`.

### 2. The model proposes tiers, deterministic rules decide

`computeTier()` in `src/parseProcess.ts` is authoritative. The model's proposal can
**lower** the result but never raise it. Brand is not an input to that function at
all — a famous logo with one screening call is Standard, and there's an eval
asserting it.

This is the rule most likely to get quietly eroded by a well-meaning prompt tweak
six months from now, which is why it's a pure function with a test rather than a
line in a prompt.

### 3. Three schema fields we have to add in Phase 1 or lose forever

Pattern review is Phase 2, but it only works if Phase 1 captured the right things.
Three cheap decisions now, expensive to backfill later:

1. **Store round *structure*, not a count.** An array of typed rounds
   (`screen`, `technical`, `system_design`, `case`, `take_home`, `panel`, `final`)
   is what lets us later spot a claimed six-round loop at a company where forty
   other records show three. A single integer throws that away permanently.
2. **Keep the candidate's raw description** alongside the parsed output.
   Near-duplicate detection across accounts is the best anti-gaming signal
   available before OAuth exists, and it's impossible without the raw text.
3. **Make account-creation timestamps queryable by employer.** Coordinated listing
   is the referral loop's failure mode and it shows up here first.

None of these need any AI. They need deciding before the first migration.

---

## What's actually in the box

```
.claude-plugin/plugin.json   Claude Code plugin manifest — drop in .claude/plugins/
skills/                      5 SKILL.md files + references (the reasoning)
agents/                      3 subagent definitions (listing / search / trust)
prompts/                     5 system prompts, framework-agnostic
src/                         ~600 lines of TypeScript, deps: @anthropic-ai/sdk + zod
schemas/                     JSON Schema per agent output
evals/                       Fixtures + runner covering the assertions that matter
```

Two ways to use it. Copy the whole directory into `.claude/plugins/` and the
skills apply to anyone writing code in the repo. Or copy `src/`, `prompts/` and
`schemas/` into the app at `lib/agents/` — that's the part that ships.

```bash
npm install @anthropic-ai/sdk zod
export ANTHROPIC_API_KEY=sk-...
npx tsx evals/run.ts     # unit checks run offline; parser checks need the key
```

---

## Suggested order

1. **`redact.ts` + `computeTier`** — no API calls, fully testable, and everything
   else depends on them. An afternoon.
2. **`process-parser`** — unblocks the listing flow, which is the top of the
   funnel and the thing to get in front of real candidates first.
3. **`redaction-audit`** — must land before anything publishes to the circuit
   feed. Don't ship the feed without it.
4. **`record-matcher`** — the recruiter side, once there are records to rank.
5. **`interview-brief`** — on approved intros only. Never pre-generate for an
   unapproved record.
6. **`pattern-review`** — Phase 2, but read `skills/pattern-review/references/signals.md`
   now, because of the three schema fields above.

---

## Open questions I'd like a view on

- **Is k=8 right?** It's a judgement call, not a standard. Too high and the early
  pool publishes nothing; too low and we break the core promise. It's one constant
  in `src/redactionAudit.ts`.
- **Do we tell candidates why a record was withheld?** Currently yes, in plain
  language. The counter-argument is that it teaches people how to phrase records
  to slip past the check.
- **Should the parser ever auto-approve a tier promotion from a known offer rate?**
  Right now it can promote at most one step, and only from a *known* figure — never
  a guess. That means we need a real offer-rate table, which we don't have yet.
- **Model IDs** in `src/client.ts` need checking against current Anthropic docs
  before we ship. I've routed most things to Sonnet and only pattern review to
  Opus, since that one runs in batch and is the only genuinely adversarial task.
