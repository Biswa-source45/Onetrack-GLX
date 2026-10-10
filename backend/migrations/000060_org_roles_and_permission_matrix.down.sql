-- Down 000060: remove the 10 new organisation roles and restore Bid Executive / Finance
DELETE FROM auth.user_roles
WHERE role_id IN (SELECT id FROM auth.roles WHERE name IN ('MANAGING_DIRECTOR', 'ACCOUNTS_MANAGER', 'PRESALES_MANAGER', 'SALES_MANAGER', 'REPORTING_MANAGER', 'BID_MANAGER', 'DELIVERY_MANAGER', 'FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'SOFTWARE_DEVELOPER'));

DELETE FROM auth.role_permissions
WHERE role_id IN (SELECT id FROM auth.roles WHERE name IN ('MANAGING_DIRECTOR', 'ACCOUNTS_MANAGER', 'PRESALES_MANAGER', 'SALES_MANAGER', 'REPORTING_MANAGER', 'BID_MANAGER', 'DELIVERY_MANAGER', 'FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'SOFTWARE_DEVELOPER'));

DELETE FROM auth.roles
WHERE name IN ('MANAGING_DIRECTOR', 'ACCOUNTS_MANAGER', 'PRESALES_MANAGER', 'SALES_MANAGER', 'REPORTING_MANAGER', 'BID_MANAGER', 'DELIVERY_MANAGER', 'FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'SOFTWARE_DEVELOPER');

-- Bid Executive back to its pre-000060 grants: no bid.delete / user.edit, analytics.view restored.
DELETE FROM auth.role_permissions
WHERE role_id = (SELECT id FROM auth.roles WHERE name = 'BID_EXECUTIVE')
  AND permission_id IN (SELECT id FROM auth.permissions WHERE (resource || '.' || action) IN ('bid.delete', 'user.edit'));

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE (r.name = 'BID_EXECUTIVE' OR r.name = 'FINANCE')
  AND p.resource = 'analytics' AND p.action = 'view'
ON CONFLICT DO NOTHING;
