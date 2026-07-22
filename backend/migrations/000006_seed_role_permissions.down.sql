-- Rollback Migration 000006
-- Remove bid + task permissions from non-admin roles
DELETE FROM auth.role_permissions
WHERE role_id IN (
    SELECT id FROM auth.roles WHERE name IN ('BID_MANAGER','BID_OWNER','REVIEWER','FINANCE','MANAGEMENT','OPERATOR')
)
AND permission_id IN (
    SELECT id FROM auth.permissions WHERE resource IN ('bid', 'task')
);
