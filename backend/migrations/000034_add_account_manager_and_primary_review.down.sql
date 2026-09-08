-- Migration 000034 rollback

DELETE FROM bid.bid_workspace_members WHERE role IN ('ACCOUNT_MANAGER', 'PRESALES');
ALTER TABLE bid.bid_workspace_members DROP CONSTRAINT IF EXISTS bid_workspace_members_role_check;
ALTER TABLE bid.bid_workspace_members ADD CONSTRAINT bid_workspace_members_role_check
    CHECK (role IN ('OWNER', 'MANAGER', 'MEMBER', 'REVIEWER', 'OBSERVER'));

ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS account_manager_id,
    DROP COLUMN IF EXISTS presales_id,
    DROP COLUMN IF EXISTS location,
    DROP COLUMN IF EXISTS bg_duration_months,
    DROP COLUMN IF EXISTS requested_products,
    DROP COLUMN IF EXISTS primary_review;

DELETE FROM auth.role_permissions
WHERE role_id IN (SELECT id FROM auth.roles WHERE name = 'ACCOUNT_MANAGER');

DELETE FROM auth.user_roles
WHERE role_id IN (SELECT id FROM auth.roles WHERE name = 'ACCOUNT_MANAGER');

DELETE FROM auth.roles WHERE name = 'ACCOUNT_MANAGER';
