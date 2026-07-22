-- Seed default roles
INSERT INTO auth.roles (name, description, is_system) VALUES
    ('SUPER_ADMIN', 'Full system access', true),
    ('ADMIN', 'Administrative access', true),
    ('BID_MANAGER', 'Manages bid lifecycle and workspace', false),
    ('BID_OWNER', 'Owns specific bid workspaces', false),
    ('REVIEWER', 'Reviews qualifications and approvals', false),
    ('FINANCE', 'Commercial and financial operations', false),
    ('MANAGEMENT', 'Strategic oversight and approvals', false),
    ('OPERATOR', 'Day-to-day operational tasks', false);

-- Seed core permissions (resource.action format)
INSERT INTO auth.permissions (resource, action, description) VALUES
    -- Bid permissions
    ('bid', 'create', 'Create new bid workspace'),
    ('bid', 'view', 'View bid details'),
    ('bid', 'edit', 'Edit bid information'),
    ('bid', 'delete', 'Delete bid workspace'),
    ('bid', 'assign', 'Assign bid ownership'),
    -- Task permissions
    ('task', 'create', 'Create tasks'),
    ('task', 'view', 'View tasks'),
    ('task', 'edit', 'Edit tasks'),
    ('task', 'assign', 'Assign tasks to users'),
    ('task', 'complete', 'Mark tasks complete'),
    -- Document permissions
    ('document', 'upload', 'Upload documents'),
    ('document', 'view', 'View documents'),
    ('document', 'delete', 'Delete documents'),
    -- Qualification permissions
    ('qualification', 'view', 'View qualification results'),
    ('qualification', 'override', 'Override AI qualification'),
    ('qualification', 'approve', 'Approve qualification'),
    -- Quotation permissions
    ('quotation', 'create', 'Create quotations'),
    ('quotation', 'view', 'View quotations'),
    ('quotation', 'edit', 'Edit quotations'),
    ('quotation', 'approve', 'Approve quotations'),
    ('quotation', 'lock', 'Lock/finalize quotations'),
    -- Commercial permissions
    ('costing', 'view', 'View internal costing'),
    ('costing', 'edit', 'Edit costing details'),
    -- User management permissions
    ('user', 'create', 'Create users'),
    ('user', 'view', 'View user details'),
    ('user', 'edit', 'Edit user details'),
    ('user', 'deactivate', 'Deactivate users'),
    ('user', 'assign_role', 'Assign roles to users'),
    -- Workflow permissions
    ('workflow', 'transition', 'Trigger workflow transitions'),
    ('workflow', 'override', 'Override workflow guards'),
    -- Notification permissions
    ('notification', 'view', 'View notifications'),
    ('notification', 'manage', 'Manage notification settings'),
    -- Analytics permissions
    ('analytics', 'view', 'View analytics dashboards'),
    ('analytics', 'export', 'Export analytics data'),
    -- Admin permissions
    ('admin', 'system', 'System administration');

-- Assign all permissions to SUPER_ADMIN role
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name = 'SUPER_ADMIN';

-- Assign admin-level permissions to ADMIN role
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
CROSS JOIN auth.permissions p
WHERE r.name = 'ADMIN'
AND NOT (p.resource = 'admin' AND p.action = 'system');

-- Seed initial super admin user (password: Admin@123 - must be changed on first login)
-- bcrypt hash of 'Admin@123'
INSERT INTO auth.users (employee_code, username, password_hash, force_password_change, is_active)
VALUES ('ADMIN001', 'admin', '$2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK', true, true);

-- Assign SUPER_ADMIN role to the initial admin user
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN auth.roles r
WHERE u.username = 'admin' AND r.name = 'SUPER_ADMIN';
