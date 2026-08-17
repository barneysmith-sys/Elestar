-- Local-only: replicates the table-level grants Supabase already applies
-- automatically to anon/authenticated on every public-schema table. Run
-- this after the migration and before the pgTAP tests when testing with
-- plain psql. Not a migration; not deployed to Supabase.

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
