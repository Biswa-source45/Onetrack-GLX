-- Migration 000009 Down: Revert granting user.view permission to team roles

DELETE FROM auth.role_permissions
WHERE role_id IN (
    SELECT id FROM auth.roles WHERE name IN ('BID_MANAGER', 'BID_OWNER', 'MANAGEMENT', 'REVIEWER', 'FINANCE', 'OPERATOR')
)
AND permission_id IN (
    SELECT id FROM auth.permissions WHERE resource = 'user' AND action = 'view'
);
