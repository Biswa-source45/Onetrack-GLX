-- Add profile fields to auth.users

ALTER TABLE auth.users ADD COLUMN full_name VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE auth.users ADD COLUMN email VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN phone VARCHAR(20);
ALTER TABLE auth.users ADD COLUMN department VARCHAR(100);

CREATE INDEX idx_users_full_name ON auth.users(full_name);
CREATE INDEX idx_users_department ON auth.users(department);
CREATE UNIQUE INDEX idx_users_email ON auth.users(email) WHERE email IS NOT NULL;
