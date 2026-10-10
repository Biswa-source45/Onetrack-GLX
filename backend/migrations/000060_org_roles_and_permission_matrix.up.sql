-- Migration 000060: organisation roles + permission matrix
--
-- Adds the 10 new organisation roles (Bid Executive already exists) and sets
-- the 24 sheet permissions for all 11 EXACTLY as the business matrix says:
-- anything an org role holds outside the matrix is removed, anything missing
-- is added. Legacy roles (SUPER_ADMIN, ADMIN, MANAGER, ACCOUNT_MANAGER,
-- PRE_SALES, FINANCE) keep working untouched; users are NOT touched - people
-- are reassigned in User Management. Non-matrix permissions (calendar.*) and
-- per-user overrides are left alone. Idempotent.
--
-- Beyond the sheet: calendar.view for every org role (so the Working Calendar
-- stays reachable) and calendar.edit for Software Developer / Managing Director.
-- Bid Executive keeps lead.view (lead.create is unusable without it).

INSERT INTO auth.roles (name, description, is_system) VALUES
    ('MANAGING_DIRECTOR', 'Managing Director - full administration, tender and EMD approval, role assignment', false),
    ('ACCOUNTS_MANAGER', 'Accounts Manager - tender approving authority (Account Manager), assigns bid ownership', false),
    ('PRESALES_MANAGER', 'Presales Manager - manages pre-sales work, assigns bid ownership, acts as Manager', false),
    ('SALES_MANAGER', 'Sales Manager - tender approving authority (Account Manager)', false),
    ('REPORTING_MANAGER', 'Reporting Manager - approves tender edits, full tender lifecycle', false),
    ('BID_MANAGER', 'Bid Manager - manages the bid pipeline and full tender lifecycle', false),
    ('BID_EXECUTIVE', 'Bid Executive - tender discovery and stage-by-stage execution', false),
    ('DELIVERY_MANAGER', 'Delivery Manager - view-only visibility into tenders, analytics and users', false),
    ('FINANCE_MANAGER', 'Finance Manager - EMD, costing and financial operations', false),
    ('FINANCE_EXECUTIVE', 'Finance Executive - EMD and financial operations support', false),
    ('SOFTWARE_DEVELOPER', 'Software Developer - unrestricted system access and developer tools', false)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

WITH matrix(role_name, perms) AS (
    VALUES
        ('MANAGING_DIRECTOR', ARRAY['admin.system', 'analytics.export', 'analytics.view', 'bid.edit', 'bid.view', 'calendar.edit', 'calendar.view', 'document.view', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.assign_role']),
        ('ACCOUNTS_MANAGER', ARRAY['analytics.export', 'analytics.view', 'bid.assign', 'bid.edit', 'bid.view', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'lead.create', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.edit', 'user.view']),
        ('PRESALES_MANAGER', ARRAY['analytics.view', 'bid.assign', 'bid.edit', 'bid.view', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'lead.create', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.edit', 'user.view']),
        ('SALES_MANAGER', ARRAY['analytics.export', 'analytics.view', 'bid.edit', 'bid.view', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'lead.create', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.edit', 'user.view']),
        ('REPORTING_MANAGER', ARRAY['analytics.export', 'analytics.view', 'bid.assign', 'bid.create', 'bid.delete', 'bid.edit', 'bid.view', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'lead.create', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.edit', 'user.view']),
        ('BID_MANAGER', ARRAY['analytics.export', 'analytics.view', 'bid.assign', 'bid.create', 'bid.delete', 'bid.edit', 'bid.view', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'lead.create', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.edit', 'user.view']),
        ('BID_EXECUTIVE', ARRAY['bid.create', 'bid.delete', 'bid.edit', 'bid.view', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'lead.create', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.edit', 'user.view']),
        ('DELIVERY_MANAGER', ARRAY['analytics.export', 'analytics.view', 'bid.view', 'calendar.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.edit', 'user.view']),
        ('FINANCE_MANAGER', ARRAY['analytics.view', 'bid.edit', 'bid.view', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.edit', 'user.view']),
        ('FINANCE_EXECUTIVE', ARRAY['bid.edit', 'bid.view', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.view']),
        ('SOFTWARE_DEVELOPER', ARRAY['admin.system', 'analytics.export', 'analytics.view', 'bid.assign', 'bid.create', 'bid.delete', 'bid.edit', 'bid.view', 'calendar.edit', 'calendar.view', 'document.delete', 'document.upload', 'document.view', 'lead.create', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.assign_role', 'user.create', 'user.deactivate', 'user.edit', 'user.view'])
),
wanted AS (
    SELECT r.id AS role_id, p.id AS permission_id
    FROM matrix m
    JOIN auth.roles r ON r.name = m.role_name
    JOIN auth.permissions p ON (p.resource || '.' || p.action) = ANY(m.perms)
),
sheet_perms AS (
    SELECT id FROM auth.permissions
    WHERE (resource || '.' || action) = ANY(ARRAY['admin.system', 'analytics.export', 'analytics.view', 'bid.assign', 'bid.create', 'bid.delete', 'bid.edit', 'bid.view', 'document.delete', 'document.upload', 'document.view', 'lead.create', 'lead.view', 'notification.view', 'task.assign', 'task.complete', 'task.create', 'task.edit', 'task.view', 'user.assign_role', 'user.create', 'user.deactivate', 'user.edit', 'user.view'])
),
pruned AS (
    DELETE FROM auth.role_permissions rp
    USING auth.roles r
    WHERE rp.role_id = r.id
      AND r.name IN ('MANAGING_DIRECTOR', 'ACCOUNTS_MANAGER', 'PRESALES_MANAGER', 'SALES_MANAGER', 'REPORTING_MANAGER', 'BID_MANAGER', 'BID_EXECUTIVE', 'DELIVERY_MANAGER', 'FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'SOFTWARE_DEVELOPER')
      AND rp.permission_id IN (SELECT id FROM sheet_perms)
      AND NOT EXISTS (
          SELECT 1 FROM wanted w
          WHERE w.role_id = rp.role_id AND w.permission_id = rp.permission_id
      )
)
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT role_id, permission_id FROM wanted
ON CONFLICT DO NOTHING;

-- Legacy FINANCE never reached Analytics (the page was hidden for it by role).
-- Analytics is now gated by analytics.view, so drop it here to keep that
-- behaviour identical for existing Finance users.
DELETE FROM auth.role_permissions
WHERE role_id = (SELECT id FROM auth.roles WHERE name = 'FINANCE')
  AND permission_id = (SELECT id FROM auth.permissions WHERE resource = 'analytics' AND action = 'view');
