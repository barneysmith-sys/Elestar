-- Recruiter email is an owner-only verification credential.
-- It lives on processes (RLS already owner-only) and is never a column on
-- dossiers. Public records are a whitelist that does not include this field.

ALTER TABLE processes
  ADD COLUMN recruiter_email text;

COMMENT ON COLUMN processes.recruiter_email IS
  'Owner-only verification credential. Never copied onto dossiers or public_record.';
