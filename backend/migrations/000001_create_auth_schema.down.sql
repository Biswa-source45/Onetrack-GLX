-- Rollback auth schema

DROP TRIGGER IF EXISTS update_users_updated_at ON auth.users;
DROP FUNCTION IF EXISTS auth.update_updated_at_column();

DROP TABLE IF EXISTS auth.user_permission_overrides;
DROP TABLE IF EXISTS auth.user_roles;
DROP TABLE IF EXISTS auth.role_permissions;
DROP TABLE IF EXISTS auth.permissions;
DROP TABLE IF EXISTS auth.roles;
DROP TABLE IF EXISTS auth.users;

DROP SCHEMA IF EXISTS auth;
