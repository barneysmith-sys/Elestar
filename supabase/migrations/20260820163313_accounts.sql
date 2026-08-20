-- Account profiles for Elestar Auth.
-- Role lives here (and in auth.app_metadata set by the server), never in
-- user_metadata — that claim is user-editable and must not gate RLS.

create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('candidate', 'employer')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy profiles_self_select on profiles
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete for anon or authenticated. The signup route writes
-- with the service role after Auth creates the user.

create index if not exists profiles_role_idx on profiles (role);
