DELETE FROM auth.role_permissions
WHERE permission_id IN (SELECT id FROM auth.permissions WHERE resource = 'lead');
DELETE FROM auth.user_permission_overrides
WHERE permission_id IN (SELECT id FROM auth.permissions WHERE resource = 'lead');
DELETE FROM auth.permissions WHERE resource = 'lead';

DROP SCHEMA IF EXISTS leads CASCADE;
