-- Migration 000009: Grant user.view permission to operational team roles
-- Allows BID_MANAGER, BID_OWNER, MANAGEMENT, REVIEWER, FINANCE, and OPERATOR
-- to load the active user directory for selecting Bid Owners, Technical Managers, and Task Assignees.

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name IN ('BID_MANAGER', 'BID_OWNER', 'MANAGEMENT', 'REVIEWER', 'FINANCE', 'OPERATOR')
AND p.resource = 'user' AND p.action = 'view'
ON CONFLICT DO NOTHING;
