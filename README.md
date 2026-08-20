# elestar

An intelligence layer for hiring. A candidate submits an interview process;
Elestar redacts identity from it, structures it into rounds and competencies,
sizes the evidence against deterministic tier rules, checks it against a
k-anonymity floor, and publishes an anonymous record other people can search.
Identity is only ever released by the candidate approving a specific intro.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

No credentials are required. With no `ANTHROPIC_API_KEY` the judgement
steps (parse, verify, privacy audit, match, brief) run on the deterministic reasoners in
`lib/reasoners/`, and every surface that shows their output is labelled
`DEMO MODE · SIMULATED REASONING`. With no Supabase env vars, records persist to
an in-memory store seeded with clearly-marked synthetic records so the Circuit
and the k-anonymity floor have a real cohort to measure against.

Set the environment and the same code paths use the real thing instead:

```bash
export ANTHROPIC_API_KEY=sk-...        # model-backed judgement
export SUPABASE_URL=...                # Postgres persistence + RLS
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...   # server-only, never NEXT_PUBLIC_
```

Persistence switches on when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
both present. Apply `supabase/migrations/00000000000001_phase1_schema.sql` first:
it creates the tables, the RLS policies, and the CHECK constraint that makes an
identity on an unapproved intro request impossible.

`GET /api/status` reports which of these is live, so the deployment always
describes itself rather than being taken on trust.

## Vercel

Import `barneysmith-sys/Elestar` as a Next.js project. Root directory is the
repo root. Framework: Next.js. Node 20+. Build: `npm run build`. Install:
`npm install`.

Set production env vars in the Vercel project (never `NEXT_PUBLIC_`):

| Variable | Required in production | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes, for live judgement | Model-backed parse/audit/match/brief |
| `SUPABASE_URL` | yes | Postgres persistence |
| `SUPABASE_ANON_KEY` | yes, with Auth | Browser/session auth |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server writes; never ship to the client |
| `INBOUND_WEBHOOK_SECRET` | yes, for live mail | Signed `POST /api/inbound` |
| `ELESTAR_ALLOW_SIMULATION` | set `false` | Refuse fixture/demo inbound |
| `ELESTAR_REQUIRE_PERSISTENCE` | set `true` | Refuse writes without Supabase |

Point prove@elestar.ai at `https://elestar.ai/api/inbound` (Resend/Postmark/SES
inbound webhook). Authenticate with `x-elestar-webhook-secret` or
`Authorization: Bearer`. Live mail is **not** operational until that secret is
set; the endpoint returns 503 otherwise.

Domain: `elestar.ai` should be attached to this Vercel project. `/api/*` stays
same-origin for cookies and SSE.

## Deploying

The app needs a Node server. It cannot be a static export or a GitHub Pages
site: the pipeline streams over server-sent events, and six route handlers under
`app/api/` do the work. Vercel, Fly, Render or a container all work; importing
the repo into Vercel needs no configuration.

**Configure Supabase for any deployment other people will use.** The in-memory
store keeps its state on `globalThis`, which is per-process. That is fine for
`next start`, where there is one process, but on serverless each instance has its
own memory, so a record published on one request may be missing from the next.
The seeded records survive (they are re-created on cold start) so the Circuit and
search always work — but "submit a process and watch it appear in the Circuit",
which is the part worth demoing, needs real persistence to be reliable.

Redaction, the tier rules, the k=8 floor, evidence depth weighting, recency
discounting, fail-closed publish gating and the intro approval gate are
deterministic. They are real in both modes.

### Product surfaces

| Route | What it is |
|---|---|
| `/` | Josh's landing. Visual identity intact. Prove inbox is prove@elestar.ai. |
| `/verify` | Verify: forward a recruiter email, or simulate inbound. Streams the real pipeline. |
| `/list` | Alias of `/verify` |
| `/wall` | The published pool, anonymous. Josh's wall, Barney's Circuit records. |
| `/circuit` | Alias of `/wall` |
| `/desk` | Hiring desk (rank a req) and candidate desk (run the pipeline). |
| `/search` | Rank the pool against a role, with explicit gaps. |
| `/signals` | Aggregate intelligence over published loops. |
| `/intros` | The candidate's inbox: approve or decline an intro. |
| `/brief` | Alias of intros: the interview brief, gated on an approved intro. |
| `/system` | Which stages are rules and which are judgement |
| `/api/inbound` | Signed live mail at prove@elestar.ai. 503 until `INBOUND_WEBHOOK_SECRET` is set. |
| `/api/*` | Barney's agent backend. Same-origin cookies and SSE. |

### Tests

```bash
npm run typecheck
npm run eval:reasoners   # the judgement logic, in isolation
npm run build && PORT=3111 npm start
npm run eval:flow        # the product over HTTP, end to end
```

`eval:flow` asserts the negative cases that matter: a brief is refused before
approval and after a decline, no identity appears on a pending or declined
request, a record held by the privacy audit is unreachable by handle, no
submitted email, phone number or handle survives anywhere in the event stream,
and a recruiter mailbox never appears on Circuit, search, or a brief.

## The agent layer

The agent layer is packaged so it can be reviewed, tested and changed
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
.claude-plugin/plugin.json   Claude Code plugin manifest
skills/                      One skill per agent (SKILL.md + references)
agents/                      Subagent definitions for delegated work
prompts/                     Framework-agnostic prompt templates
src/                         TypeScript reference implementation (the agent layer)
schemas/                     JSON Schema for every agent output
evals/                       Fixtures + runners, so changes are measurable
app/                         Next.js App Router routes and API endpoints
components/                  The product console
lib/                         Orchestration: pipeline, agent dispatch, persistence
lib/reasoners/               Deterministic fallbacks for the judgement steps
supabase/migrations/         Schema, RLS policies, and the privacy CHECK constraints
public/art/                  Brand artwork
```

`lib/` is where the app-side decisions live. `lib/agents.ts` dispatches each
judgement step to a model or a deterministic reasoner and tags the result with
which one ran; `lib/store.ts` is the only module that persists records, and it
targets Supabase or the in-memory demo store behind one interface;
`lib/pipeline.ts` orchestrates the listing flow and fails closed at every step.

### Forwarded recruiter mail

Candidates **forward the recruiter or interview email to `prove@elestar.ai`**.
They do not type a recruiter address into a form. The receive step accepts
the inbound, parsing extracts company domain, role and how far the loop got,
research gathers public catalog evidence, and a cross-check scores
verification. The mailbox is stored owner-only on `processes.recruiter_email`
and asserted absent from every public payload via `assertNoRecruiterEmail`.
Personal mailbox providers fail closed. A failed verification is never
published.

The Vercel demo cannot receive real mail. `/list` simulates an arrival at
`prove@elestar.ai` and then runs the **same** pipeline. The UI is labelled
as a simulation.

## Install

**As a Claude Code plugin** - this repo *is* the plugin; install the repo URL
directly. The skills become available to anyone working in the repo, so the
rules below get applied by whoever is writing the code, not just at runtime.

**As application code** - `src/`, `prompts/` and `schemas/` are what the Next.js
app under `app/` imports directly. `src/` depends only on `@anthropic-ai/sdk`
and `zod`.

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

The app enforces these a second time, because a rule that only lives in a prompt
is a request. `assertRedacted` throws at the agent boundary and the pipeline
treats that throw as a full stop; a round-count confidence below 0.6 is held for
review instead of published; `computeTier` re-runs after the parse and its
verdict is shown next to the model's; and the k=8 floor overrides any judgement
that says publish. The deterministic reasoners in `lib/reasoners/` obey the same
five rules, so demo mode is not a mode with weaker guarantees.

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
