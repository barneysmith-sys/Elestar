-- Phase 1 listing-flow schema: processes, dossiers, intro_requests.
--
-- The guiding rule (CLAUDE.md #4): anonymity is enforced at the data layer,
-- in Postgres, not by a display rule in the app. A recruiter query must not
-- be *able* to return an unreleased identity — not "the UI hides it."
--
-- How that shakes out here:
--   - `processes` holds the raw submission and the real employer name.
--     Nobody but the owning candidate ever has a SELECT policy on it —
--     not recruiters, not even an approved intro. It never needs to be
--     joined for anything recruiter-facing.
--   - `dossiers` is what recruiters browse. `public_record` is the
--     generalized/redacted view auditRedaction produced; it must never
--     contain `employer_name_real` or any candidate identity field.
--     Recruiters can select a row only once redaction_decision = 'publish'.
--   - `intro_requests` is the *only* path by which identity ever reaches a
--     recruiter. `revealed_identity` stays null until the candidate
--     approves, and a CHECK constraint — not application code — makes a
--     non-null value on a non-approved row impossible even for a buggy
--     service-role writer.
--   - No table here has an insert/update/delete policy for anon or
--     authenticated. Every write (parse, publish, generalize, approve an
--     intro) goes through the server pipeline using the service-role key,
--     which bypasses RLS by design and is the only write path there is.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------
-- recruiters: membership table. A row here is what makes auth.uid() a
-- "recruiter" for RLS purposes below. Candidates never appear in it.
-- ------------------------------------------------------------------------
create table if not exists recruiters (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  company_id uuid,
  created_at timestamptz not null default now()
);

alter table recruiters enable row level security;

create policy recruiters_self_select on recruiters
  for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- processes: the raw submission. Owner-only, full stop.
-- ------------------------------------------------------------------------
create table if not exists processes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  raw_description     text not null,
  employer_name_real  text,
  rounds              jsonb not null,  -- typed Round[] — never a bare count
  parsed              jsonb not null,  -- full ParsedProcess snapshot
  created_at          timestamptz not null default now()
);

alter table processes enable row level security;

create policy processes_owner_select on processes
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for anon or authenticated, and no select
-- policy for recruiters. RLS enabled + zero matching policies denies by
-- default for every role that doesn't own the row.

create index if not exists processes_user_id_idx on processes (user_id);

-- ------------------------------------------------------------------------
-- dossiers: the anonymized, recruiter-browsable record.
-- ------------------------------------------------------------------------
create table if not exists dossiers (
  id                  uuid primary key default gen_random_uuid(),
  process_id          uuid not null references processes(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  tier                text not null check (tier in ('apex','elite','verified','standard')),
  evidence            text not null check (evidence in ('self_attested','corroborated','confirmed','flagged')),
  redaction_decision  text not null check (redaction_decision in ('publish','generalize','withhold')),
  public_record       jsonb not null,
  created_at          timestamptz not null default now()
);

alter table dossiers enable row level security;

create policy dossiers_owner_select on dossiers
  for select
  using (auth.uid() = user_id);

-- Recruiters see a row only once it has cleared redaction. public_record
-- never carries identity by construction, so this alone is safe — identity
-- is a wholly separate table gated by intro_requests below.
create policy dossiers_recruiter_select on dossiers
  for select
  using (
    redaction_decision = 'publish'
    and exists (select 1 from recruiters r where r.user_id = auth.uid())
  );

create index if not exists dossiers_user_id_idx on dossiers (user_id);
create index if not exists dossiers_process_id_idx on dossiers (process_id);
create index if not exists dossiers_publish_idx on dossiers (redaction_decision) where redaction_decision = 'publish';

-- ------------------------------------------------------------------------
-- intro_requests: the only mechanism by which identity can ever reach a
-- recruiter.
-- ------------------------------------------------------------------------
create table if not exists intro_requests (
  id                  uuid primary key default gen_random_uuid(),
  dossier_id          uuid not null references dossiers(id) on delete cascade,
  candidate_id        uuid not null references auth.users(id) on delete cascade,
  recruiter_id        uuid not null references auth.users(id) on delete cascade,
  status              text not null default 'pending' check (status in ('pending','approved','declined')),
  revealed_identity   jsonb,
  requested_at        timestamptz not null default now(),
  decided_at          timestamptz,
  constraint revealed_only_when_approved check (
    (status = 'approved') or (revealed_identity is null)
  )
);

alter table intro_requests enable row level security;

-- Candidate sees every request against their own dossiers, so they have
-- something to approve or decline.
create policy intro_requests_candidate_select on intro_requests
  for select
  using (auth.uid() = candidate_id);

-- Recruiter sees only their own requests. revealed_identity on that row is
-- null until status = 'approved' — guaranteed by the CHECK constraint
-- above, not by trusting whatever wrote the row.
create policy intro_requests_recruiter_select on intro_requests
  for select
  using (auth.uid() = recruiter_id);

-- No insert/update policy for anon or authenticated: requesting an intro
-- and approving one both go through the server pipeline (service role),
-- which is what lets the CHECK constraint's invariant hold server-side
-- instead of trusting a client PATCH not to set revealed_identity early.

create index if not exists intro_requests_dossier_id_idx on intro_requests (dossier_id);
create index if not exists intro_requests_recruiter_id_idx on intro_requests (recruiter_id);
create index if not exists intro_requests_candidate_id_idx on intro_requests (candidate_id);
