-- Migration 000034: Account Manager role + Primary Review stage support
--
-- Adds the ACCOUNT_MANAGER role (mirrors MANAGER's permission set — the
-- approving authority for a tender), the columns needed to assign an
-- Account Manager / Pre-Sales person to a tender, the RFP products/services
-- table, BG duration, a Location field, and the Primary Review stage's own
-- workspace JSONB (EMD decision, presales OEM mapping).

-- 1. New role
INSERT INTO auth.roles (name, description, is_system) VALUES
    ('ACCOUNT_MANAGER', 'Approving authority for a tender — owns Primary Review Go/No-Go, EMD mode, and pricing sign-off', false)
ON CONFLICT (name) DO NOTHING;

-- Mirror MANAGER's permission set exactly (same tier of access).
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name = 'ACCOUNT_MANAGER'
  AND (p.resource || '.' || p.action) IN (
    'bid.create', 'bid.view', 'bid.edit', 'bid.delete', 'bid.assign',
    'task.create', 'task.view', 'task.edit', 'task.assign', 'task.complete',
    'document.upload', 'document.view', 'document.delete',
    'user.view',
    'analytics.view', 'analytics.export',
    'notification.view'
  )
ON CONFLICT DO NOTHING;

-- 2. New bid_workspaces columns
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS account_manager_id  UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS presales_id         UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS location            TEXT,
    ADD COLUMN IF NOT EXISTS bg_duration_months  INT,
    ADD COLUMN IF NOT EXISTS requested_products  JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS primary_review      JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_bid_workspaces_account_manager ON bid.bid_workspaces(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_bid_workspaces_presales ON bid.bid_workspaces(presales_id);

-- Allow the two new team-panel roles as bid_workspace_members rows.
ALTER TABLE bid.bid_workspace_members DROP CONSTRAINT IF EXISTS bid_workspace_members_role_check;
ALTER TABLE bid.bid_workspace_members ADD CONSTRAINT bid_workspace_members_role_check
    CHECK (role IN ('OWNER', 'MANAGER', 'MEMBER', 'REVIEWER', 'OBSERVER', 'ACCOUNT_MANAGER', 'PRESALES'));

-- 3. Critical backfill: every tender already past DISCOVERED must be treated
-- as having already cleared Primary Review, otherwise the new stage-locking
-- rule (added in application code, not SQL) would instantly lock OEM
-- Authorization / Pricing / Document Checklist / EMD Processing on every
-- in-flight tender the moment this ships.
UPDATE bid.bid_workspaces
SET stage_completions = COALESCE(stage_completions, '{}'::jsonb) || '{"PRIMARY_REVIEW": true}'::jsonb
WHERE workflow_stage <> 'DISCOVERED';
