-- Profile + recruiter rows for self-serve signup (publishable key, no service role).
-- Role is copied from raw_user_meta_data only on INSERT of auth.users — later
-- edits to user_metadata cannot change the profile. Execute is revoked from
-- API roles; only the trigger on auth.users may run it.

create or replace function public.handle_elestar_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen text;
begin
  chosen := new.raw_user_meta_data->>'role';
  if chosen not in ('candidate', 'employer') then
    chosen := 'candidate';
  end if;

  insert into public.profiles (user_id, role)
  values (new.id, chosen)
  on conflict (user_id) do nothing;

  if chosen = 'employer' then
    insert into public.recruiters (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_elestar_new_user() from public, anon, authenticated;

drop trigger if exists on_elestar_auth_user_created on auth.users;
create trigger on_elestar_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_elestar_new_user();

-- Session user can insert their own row if the trigger did not (or raced).
-- No update/delete: role is not user-editable after create.
drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists recruiters_self_insert on recruiters;
create policy recruiters_self_insert on recruiters
  for insert
  with check (auth.uid() = user_id);
