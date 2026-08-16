# elestar-agents

The agent layer of elestar, packaged so it can be reviewed, tested and changed
independently of the app.

Five agents. Each takes structured input, returns structured output, and is
individually testable. Nothing here holds state, touches a database, or knows
what framework the app is written in.

| Agent | Job | Ships |
|---|---|---|
| `process-parser` | Freeform description of an interview loop -> structured Process record + proposed tier | Phase 1 |
| `redaction-audit` | Scores a record for re-identification risk **before** it is ever published | Phase 1 |
| `record-matcher` | Role spec + anonymized record set -> ranked shortlist with rationale | Phase 1 |
| `interview-brief` | Approved record + role -> what's been tested, what to skip, what to probe | Phase 1 |
| `pattern-review` | Record + pool context -> inflation and fabrication flags for human review | Phase 2 |

## Layout

```
elestar-agents/
  .claude-plugin/plugin.json   Claude Code plugin manifest
  skills/                      One skill per agent (SKILL.md + references)
  agents/                      Subagent definitions for delegated work
  prompts/                     Framework-agnostic prompt templates
  src/                         TypeScript reference implementation
  schemas/                     JSON Schema for every agent output
  evals/                       Fixtures + runner, so changes are measurable
```

## Install

**As a Claude Code plugin** - copy this directory into `.claude/plugins/` in the
elestar repo. The skills become available to anyone working in the repo, so the
rules below get applied by whoever is writing the code, not just at runtime.

**As application code** - `src/` is the part that ships. It depends only on
`@anthropic-ai/sdk` and `zod`. Copy `src/`, `prompts/` and `schemas/` into the
Next.js app under `lib/agents/`.

```bash
npm install @anthropic-ai/sdk zod
export ANTHROPIC_API_KEY=sk-...
npx tsx evals/run.ts          # sanity check against fixtures
```

## Five rules that apply to every agent here

1. **Never invent a round.** If a description is ambiguous the parser returns a
   clarifying question, not a guess. Inflation introduced by our own model is
   worse than inflation introduced by a candidate, because it is invisible and
   it is our fault.
2. **The model never sees an identity.** Names, emails and current employers are
   stripped before any prompt is built. See `src/redact.ts`.
3. **Every output is schema-validated before it touches the database.** A response
   that fails validation is retried once, then routed to human review.
4. **Every output carries a confidence and a reason.** Anything a recruiter sees
   must be explainable to the candidate it describes.
5. **The model proposes, a rule or a human disposes.** No agent in this package
   writes to the database, and none of them can raise a tier past what the
   deterministic rules in `references/tier-rules.md` allow.

## Model routing

Set once in `src/client.ts`. Verify the identifiers against current Anthropic
docs before shipping - model names change.

| Agent | Model | Why |
|---|---|---|
| process-parser | Sonnet | Extraction with judgement; runs once per listing |
| redaction-audit | Sonnet | Gets the privacy call wrong once and the product is over |
| record-matcher | Sonnet | Ranking quality is the product |
| interview-brief | Sonnet | Customer-visible prose |
| pattern-review | Opus | Adversarial reasoning across many records, runs in batch |
