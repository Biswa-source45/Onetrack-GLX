-- Migration 000006: Assign bid + task permissions to roles

-- BID_MANAGER: full bid + task access
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name = 'BID_MANAGER'
AND (
    (p.resource = 'bid') OR
    (p.resource = 'task') OR
    (p.resource = 'document') OR
    (p.resource = 'qualification' AND p.action IN ('view', 'override')) OR
    (p.resource = 'quotation' AND p.action IN ('create', 'view', 'edit')) OR
    (p.resource = 'workflow' AND p.action = 'transition') OR
    (p.resource = 'notification' AND p.action = 'view')
)
ON CONFLICT DO NOTHING;

-- BID_OWNER: create/manage own bids + tasks
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name = 'BID_OWNER'
AND (
    (p.resource = 'bid' AND p.action IN ('create', 'view', 'edit')) OR
    (p.resource = 'task') OR
    (p.resource = 'document' AND p.action IN ('upload', 'view')) OR
    (p.resource = 'quotation' AND p.action IN ('create', 'view', 'edit')) OR
    (p.resource = 'workflow' AND p.action = 'transition') OR
    (p.resource = 'notification' AND p.action = 'view')
)
ON CONFLICT DO NOTHING;

-- REVIEWER: read-only on bids + tasks, can approve/review
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name = 'REVIEWER'
AND (
    (p.resource = 'bid' AND p.action = 'view') OR
    (p.resource = 'task' AND p.action IN ('view', 'edit', 'complete')) OR
    (p.resource = 'document' AND p.action = 'view') OR
    (p.resource = 'qualification' AND p.action IN ('view', 'approve')) OR
    (p.resource = 'quotation' AND p.action IN ('view', 'approve')) OR
    (p.resource = 'notification' AND p.action = 'view')
)
ON CONFLICT DO NOTHING;

-- FINANCE: bid view + quotation full access + costing
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name = 'FINANCE'
AND (
    (p.resource = 'bid' AND p.action = 'view') OR
    (p.resource = 'task' AND p.action IN ('view', 'edit', 'complete')) OR
    (p.resource = 'quotation') OR
    (p.resource = 'costing') OR
    (p.resource = 'notification' AND p.action = 'view')
)
ON CONFLICT DO NOTHING;

-- MANAGEMENT: read access everywhere + final approval
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name = 'MANAGEMENT'
AND (
    (p.resource = 'bid' AND p.action = 'view') OR
    (p.resource = 'task' AND p.action = 'view') OR
    (p.resource = 'document' AND p.action = 'view') OR
    (p.resource = 'qualification' AND p.action IN ('view', 'approve', 'override')) OR
    (p.resource = 'quotation' AND p.action IN ('view', 'approve', 'lock')) OR
    (p.resource = 'costing' AND p.action = 'view') OR
    (p.resource = 'analytics') OR
    (p.resource = 'notification' AND p.action = 'view') OR
    (p.resource = 'workflow' AND p.action = 'override')
)
ON CONFLICT DO NOTHING;

-- OPERATOR: operational execution — bid + task worker
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name = 'OPERATOR'
AND (
    (p.resource = 'bid' AND p.action IN ('view', 'edit')) OR
    (p.resource = 'task' AND p.action IN ('view', 'edit', 'assign', 'complete')) OR
    (p.resource = 'document' AND p.action IN ('upload', 'view')) OR
    (p.resource = 'notification' AND p.action = 'view')
)
ON CONFLICT DO NOTHING;
