-- RLS policy tests for the Phase 1 listing-flow schema.
-- Written before supabase/migrations/00000000000001_phase1_schema.sql —
-- run with `supabase test db` (pgTAP), or locally via:
--   psql -f supabase/tests/_local_auth_shim.sql \
--        -f supabase/migrations/00000000000001_phase1_schema.sql \
--        -f supabase/tests/database/rls_policies.test.sql
--
-- The one property every test here ultimately serves: a recruiter query
-- must not be *able* to return an unreleased identity. Not "shouldn't",
-- not "the UI won't show it" — the query itself returns zero rows or a
-- null column, enforced by Postgres, not by application code.

begin;
select plan(19);

-- ---- fixtures (seeded as postgres, which bypasses RLS) --------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'candidate-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'candidate-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'recruiter-a@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'recruiter-b@example.com');

insert into recruiters (user_id) values
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444');

-- Candidate A: a withheld process (thin cohort, real employer name on file)
insert into processes (id, user_id, raw_description, employer_name_real, rounds, parsed)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'five rounds at a series B fintech, ~300 people, london',
  'Acme Fintech Ltd',
  '[{"index":1,"type":"screen","label":"recruiter screen","cleared":true}]'::jsonb,
  '{"roundsCleared":5}'::jsonb
);

insert into dossiers (id, process_id, user_id, tier, evidence, redaction_decision, public_record)
values (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'elite', 'self_attested', 'withhold',
  '{"sector":"fintech"}'::jsonb
);

-- Candidate B: a published process
insert into processes (id, user_id, raw_description, employer_name_real, rounds, parsed)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  'four rounds at a payments company',
  'Beta Payments Inc',
  '[{"index":1,"type":"screen","label":"recruiter screen","cleared":true}]'::jsonb,
  '{"roundsCleared":4}'::jsonb
);

insert into dossiers (id, process_id, user_id, tier, evidence, redaction_decision, public_record)
values (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  'elite', 'self_attested', 'publish',
  '{"sector":"payments"}'::jsonb
);

-- Recruiter A requested an intro on B's dossier and B approved it.
insert into intro_requests (id, dossier_id, candidate_id, recruiter_id, status, revealed_identity, decided_at)
values (
  'cccccccc-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'approved',
  '{"employerName":"Beta Payments Inc"}'::jsonb,
  now()
);

-- Recruiter B requested the same intro but candidate B hasn't decided yet.
insert into intro_requests (id, dossier_id, candidate_id, recruiter_id, status, revealed_identity)
values (
  'cccccccc-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  'pending',
  null
);

-- ---- RLS is actually turned on, not just policies sitting unused ----------
select ok(
  (select relrowsecurity from pg_class where relname = 'processes'),
  'RLS enabled on processes'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'dossiers'),
  'RLS enabled on dossiers'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'intro_requests'),
  'RLS enabled on intro_requests'
);

-- ---- processes: owner-only, full stop -------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select results_eq(
  $$ select count(*)::int from processes $$,
  $$ values (1) $$,
  'candidate A sees exactly their own process row'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$ select employer_name_real from processes where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ select null::text where false $$,
  'candidate B cannot see candidate A''s process at all (not just the identity field)'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$ select count(*)::int from processes $$,
  $$ values (0) $$,
  'recruiter A sees zero rows in processes, unconditionally — no policy grants it any'
);

-- anon (no jwt claim at all) sees nothing either
reset request.jwt.claim.sub;
select results_eq(
  $$ select count(*)::int from processes $$,
  $$ values (0) $$,
  'unauthenticated caller sees zero rows in processes'
);

-- ---- dossiers: owner always; recruiter only when published ----------------
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$ select redaction_decision from dossiers where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  $$ values ('withhold') $$,
  'candidate A can see their own withheld dossier'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$ select count(*)::int from dossiers where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  $$ values (0) $$,
  'recruiter cannot select a withheld dossier'
);
select results_eq(
  $$ select count(*)::int from dossiers where redaction_decision != 'publish' $$,
  $$ values (0) $$,
  'recruiter sees zero unpublished dossiers, as a set, not just this one row'
);
select results_eq(
  $$ select count(*)::int from dossiers where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  $$ values (1) $$,
  'recruiter can select the published dossier'
);

-- a non-recruiter authenticated user (candidate A) never gets the
-- recruiter policy's grant, even for a published dossier that isn't theirs
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$ select count(*)::int from dossiers where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  $$ values (0) $$,
  'a candidate who is not a recruiter cannot browse another candidate''s published dossier via the recruiter policy'
);

-- ---- intro_requests: the only path to identity -----------------------------
-- Recruiter B's own request is still pending — revealed_identity must be null.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select results_eq(
  $$ select revealed_identity from intro_requests where id = 'cccccccc-0000-0000-0000-000000000002' $$,
  $$ select null::jsonb $$,
  'recruiter B sees null identity on their own pending request'
);

-- Recruiter B cannot see recruiter A's approved request at all.
select results_eq(
  $$ select count(*)::int from intro_requests where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  $$ values (0) $$,
  'recruiter B cannot select recruiter A''s intro request'
);

-- Recruiter A's own request is approved — this is the one legitimate reveal.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$ select revealed_identity->>'employerName' from intro_requests where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  $$ values ('Beta Payments Inc') $$,
  'recruiter A sees the revealed identity only on their own approved request'
);

select results_eq(
  $$ select count(*)::int from intro_requests where id = 'cccccccc-0000-0000-0000-000000000002' $$,
  $$ values (0) $$,
  'recruiter A cannot select recruiter B''s pending request'
);

-- Candidate B (the dossier owner) sees both requests against their dossier,
-- so they have something to approve or decline.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$ select count(*)::int from intro_requests where dossier_id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  $$ values (2) $$,
  'candidate B sees every intro request against their own dossier'
);

-- ---- the CHECK constraint holds even for a writer that bypasses RLS -------
-- This is the backstop: even a bug in the service-role pipeline that tries
-- to populate revealed_identity before approval is rejected by the schema
-- itself, not by trusting the code path that got there.
reset role;
select throws_ok(
  $$ insert into intro_requests (dossier_id, candidate_id, recruiter_id, status, revealed_identity)
     values ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333', 'pending', '{"employerName":"leaked"}'::jsonb) $$,
  '23514',
  'new row for relation "intro_requests" violates check constraint "revealed_only_when_approved"',
  'a pending row can never carry a non-null revealed_identity, even bypassing RLS as postgres'
);

-- ---- writes: no anon/authenticated policy exists for any of these tables --
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$ insert into dossiers (process_id, user_id, tier, evidence, redaction_decision, public_record)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
             'apex', 'self_attested', 'publish', '{}'::jsonb) $$,
  '42501',
  'new row violates row-level security policy for table "dossiers"',
  'even the dossier''s own candidate cannot insert directly — publish only happens via the service-role pipeline'
);

select * from finish();
rollback;
