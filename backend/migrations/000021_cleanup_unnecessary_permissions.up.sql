-- Migration 000021: Cleanup Unnecessary Permissions and Align Roles with V2 Architecture

-- 1. Remove deprecated / non-existent permissions from role assignments and user overrides
DELETE FROM auth.user_permission_overrides
WHERE permission_id IN (
    SELECT id FROM auth.permissions
    WHERE (resource || '.' || action) IN (
        'qualification.view', 'qualification.override', 'qualification.approve',
        'quotation.create', 'quotation.view', 'quotation.edit', 'quotation.approve', 'quotation.lock',
        'costing.view', 'costing.edit',
        'workflow.transition', 'workflow.override',
        'notification.manage'
    )
);

DELETE FROM auth.role_permissions
WHERE permission_id IN (
    SELECT id FROM auth.permissions
    WHERE (resource || '.' || action) IN (
        'qualification.view', 'qualification.override', 'qualification.approve',
        'quotation.create', 'quotation.view', 'quotation.edit', 'quotation.approve', 'quotation.lock',
        'costing.view', 'costing.edit',
        'workflow.transition', 'workflow.override',
        'notification.manage'
    )
);

-- Delete obsolete permissions from auth.permissions
DELETE FROM auth.permissions
WHERE (resource || '.' || action) IN (
    'qualification.view', 'qualification.override', 'qualification.approve',
    'quotation.create', 'quotation.view', 'quotation.edit', 'quotation.approve', 'quotation.lock',
    'costing.view', 'costing.edit',
    'workflow.transition', 'workflow.override',
    'notification.manage'
);

-- 2. Ensure all active system permissions exist with clear descriptions
INSERT INTO auth.permissions (resource, action, description) VALUES
    -- Bid / Tender Workspace
    ('bid', 'create',       'Allows creating new tender workspaces manually or via bulk excel upload'),
    ('bid', 'view',         'Allows viewing tender details, stages, and metrics'),
    ('bid', 'edit',         'Allows modifying tender specifications, dates, and stage data'),
    ('bid', 'delete',       'Allows soft-deleting and purging tender workspaces'),
    ('bid', 'assign',       'Allows assigning Bid Owners and Managers to tender workspaces'),
    -- Tasks & Checklists
    ('task', 'create',      'Allows creating checklist items and subtasks'),
    ('task', 'view',        'Allows viewing task boards and checklists'),
    ('task', 'edit',        'Allows updating task titles, priorities, and deadlines'),
    ('task', 'assign',      'Allows assigning checklist tasks to team members'),
    ('task', 'complete',    'Allows marking checklist tasks as complete'),
    -- Documents
    ('document', 'upload',  'Allows uploading tender PDFs, specs, and OEM certificates'),
    ('document', 'view',    'Allows viewing and downloading attached documents'),
    ('document', 'delete',  'Allows deleting attached files and documents'),
    -- User Management
    ('user', 'create',      'Allows creating system users and credentials'),
    ('user', 'view',        'Allows viewing user directory and profiles'),
    ('user', 'edit',        'Allows editing user profile information'),
    ('user', 'deactivate',  'Allows deactivating / activating user accounts'),
    ('user', 'assign_role', 'Allows assigning roles and permission overrides to users'),
    -- Analytics & Reporting
    ('analytics', 'view',   'Allows viewing win/loss metrics and stage analytics dashboards'),
    ('analytics', 'export', 'Allows exporting analytics and tender reports to Excel/PDF'),
    -- Notifications
    ('notification', 'view','Allows viewing system notifications and alerts'),
    -- System Administration
    ('admin', 'system',     'Full administrative access to all system features and configurations')
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;

-- 3. Clean up any legacy non-V2 roles (migrate users to standard V2 roles if needed)
INSERT INTO auth.roles (name, description, is_system) VALUES
    ('SUPER_ADMIN',   'Unrestricted system control, user management, and executive analytics', true),
    ('ADMIN',         'System administration, user management, and stage overrides', true),
    ('MANAGER',       'Bid pipeline lead, tender workspace management, and executive reports', false),
    ('BID_EXECUTIVE', 'Tender discovery and stage-by-stage lifecycle manager', false),
    ('PRE_SALES',     'Technical eligibility assessor and pre-sales analyst', false),
    ('FINANCE',       'EMD deposits and Bank Guarantee (BG) processing specialist', false)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

-- Map any lingering users with legacy roles to V2 roles
UPDATE auth.user_roles
SET role_id = (SELECT id FROM auth.roles WHERE name = 'MANAGER' LIMIT 1)
WHERE role_id IN (SELECT id FROM auth.roles WHERE name = 'BID_MANAGER');

UPDATE auth.user_roles
SET role_id = (SELECT id FROM auth.roles WHERE name = 'BID_EXECUTIVE' LIMIT 1)
WHERE role_id IN (SELECT id FROM auth.roles WHERE name = 'BID_OWNER' OR name = 'OPERATOR');

UPDATE auth.user_roles
SET role_id = (SELECT id FROM auth.roles WHERE name = 'PRE_SALES' LIMIT 1)
WHERE role_id IN (SELECT id FROM auth.roles WHERE name = 'REVIEWER');

DELETE FROM auth.roles
WHERE name IN ('BID_MANAGER', 'BID_OWNER', 'REVIEWER', 'MANAGEMENT', 'OPERATOR');

-- 4. Seed role permissions for all 6 V2 roles

-- SUPER_ADMIN & ADMIN: All permissions
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

-- MANAGER: Bid full, Task full, Document full, User view, Analytics full, Notification view
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'MANAGER'
  AND (p.resource || '.' || p.action) IN (
    'bid.create', 'bid.view', 'bid.edit', 'bid.delete', 'bid.assign',
    'task.create', 'task.view', 'task.edit', 'task.assign', 'task.complete',
    'document.upload', 'document.view', 'document.delete',
    'user.view',
    'analytics.view', 'analytics.export',
    'notification.view'
  )
ON CONFLICT DO NOTHING;

-- BID_EXECUTIVE: Bid create/view/edit, Task full, Document full, User view, Analytics view, Notification view
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'BID_EXECUTIVE'
  AND (p.resource || '.' || p.action) IN (
    'bid.create', 'bid.view', 'bid.edit',
    'task.create', 'task.view', 'task.edit', 'task.assign', 'task.complete',
    'document.upload', 'document.view', 'document.delete',
    'user.view',
    'analytics.view',
    'notification.view'
  )
ON CONFLICT DO NOTHING;

-- PRE_SALES: Bid view/edit, Task view/edit/complete, Document full, User view, Analytics view, Notification view
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'PRE_SALES'
  AND (p.resource || '.' || p.action) IN (
    'bid.view', 'bid.edit',
    'task.view', 'task.edit', 'task.complete',
    'document.upload', 'document.view', 'document.delete',
    'user.view',
    'analytics.view',
    'notification.view'
  )
ON CONFLICT DO NOTHING;

-- FINANCE: Bid view/edit, Task view/edit/complete, Document view/upload, User view, Analytics view, Notification view
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'FINANCE'
  AND (p.resource || '.' || p.action) IN (
    'bid.view', 'bid.edit',
    'task.view', 'task.edit', 'task.complete',
    'document.upload', 'document.view',
    'user.view',
    'analytics.view',
    'notification.view'
  )
ON CONFLICT DO NOTHING;
