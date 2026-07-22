-- Remove profile fields from auth.users

DROP INDEX IF EXISTS auth.idx_users_email;
DROP INDEX IF EXISTS auth.idx_users_department;
DROP INDEX IF EXISTS auth.idx_users_full_name;

ALTER TABLE auth.users DROP COLUMN IF EXISTS department;
ALTER TABLE auth.users DROP COLUMN IF EXISTS phone;
ALTER TABLE auth.users DROP COLUMN IF EXISTS email;
ALTER TABLE auth.users DROP COLUMN IF EXISTS full_name;
