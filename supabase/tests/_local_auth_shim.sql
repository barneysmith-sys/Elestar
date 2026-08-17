-- Local-only stand-in for what a real Supabase project already provides:
-- the `auth` schema, `auth.uid()`, and the anon/authenticated/service_role
-- roles. This file is NOT a migration and is NOT deployed to Supabase —
-- it exists purely so RLS policies can be exercised with plain `psql`
-- (e.g. in CI or a sandbox without the Supabase CLI/Docker available).
-- Against a real Supabase project, skip this file entirely; `supabase
-- test db` already has the genuine auth schema.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

-- Mirrors what Supabase grants its own anon/authenticated roles by default:
-- broad table-level DML privilege, with RLS policies doing the real gating.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
grant all on all tables in schema public to service_role;
