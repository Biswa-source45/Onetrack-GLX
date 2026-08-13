-- Revert Migration 000022: Add Primary & Secondary Role Support to auth.user_roles

DROP INDEX IF EXISTS auth.idx_user_roles_order;

ALTER TABLE auth.user_roles
    DROP COLUMN IF EXISTS is_primary,
    DROP COLUMN IF EXISTS role_order;
