-- Migration 000010: OneTrack V2 Architecture & GeM Pipeline Migration

-- 1. Ensure email column exists on auth.users and supports email login
ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

-- Update or insert Super Admin user with default email and credentials
INSERT INTO auth.users (employee_code, username, email, password_hash, force_password_change, is_active)
VALUES ('SUPERADMIN001', 'Sadmin', 'biswabhusans@globx.co.in', '$2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK', false, true)
ON CONFLICT (username) DO UPDATE
SET email = 'biswabhusans@globx.co.in',
    is_active = true;

-- 2. Upsert core system roles
INSERT INTO auth.roles (name, description, is_system) VALUES
    ('SUPER_ADMIN', 'Unrestricted system control, user management, and executive analytics', true),
    ('ADMIN', 'System administration, user management, and stage overrides', true),
    ('MANAGER', 'Bid pipeline lead, tender workspace management, and executive reports', false),
    ('BID_EXECUTIVE', 'Tender discovery and stage-by-stage lifecycle manager', false),
    ('PRE_SALES', 'Technical eligibility assessor and pre-sales analyst', false),
    ('FINANCE', 'EMD deposits and Bank Guarantee (BG) processing specialist', false)
ON CONFLICT (name) DO NOTHING;

-- Ensure Super Admin role assignment to Sadmin user
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r
WHERE u.username = 'Sadmin' AND r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- 3. Update bid.bid_workspaces with V2 pipeline columns
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS high_level_scope      TEXT,
    ADD COLUMN IF NOT EXISTS start_date            TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date              TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS duration_months       INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS bg_required           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS authority             TEXT,
    ADD COLUMN IF NOT EXISTS department            TEXT,
    ADD COLUMN IF NOT EXISTS oem_tracking          JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS distributor_quotes    JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS pricing_calculation   JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS document_checklists   JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS technical_result      VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS disqualification_reason TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS financial_result     VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS l1_company_name       TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS l1_price              NUMERIC(15, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS price_difference      NUMERIC(15, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS price_difference_pct  NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS emd_returned          BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS bg_discharged         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS eligibility_remarks   TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS emd_remarks           TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS emd_ready             BOOLEAN NOT NULL DEFAULT false;

-- 4. Alerts & System Notifications table
CREATE TABLE IF NOT EXISTS public.alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_role VARCHAR(50) DEFAULT '',
    bid_id      UUID REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_target_role ON public.alerts(target_role);
CREATE INDEX IF NOT EXISTS idx_alerts_bid_id ON public.alerts(bid_id);
