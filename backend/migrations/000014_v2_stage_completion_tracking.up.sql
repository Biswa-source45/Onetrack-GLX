-- Migration 000014: V2 Stage Completion Tracking & Auth Password Standardisation

-- 1. Reset Sadmin to Admin@123 (bcrypt: $2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK)
UPDATE auth.users 
SET password_hash = '$2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK',
    force_password_change = false,
    is_active = true
WHERE username = 'Sadmin';

-- 2. Add stage completion tracking columns to bid_workspaces
-- Each of the 12 stages can be independently marked complete with a timestamp and actor
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS stage_completions     JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS stage_remarks         JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS checklist_type        VARCHAR(30) DEFAULT 'BIDDER',
    ADD COLUMN IF NOT EXISTS finance_alerted       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS finance_alert_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gem_submission_price  NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS final_price           NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS submission_done       BOOLEAN NOT NULL DEFAULT false;

-- 3. Add checklist_group column to bid_checklists for separating BIDDER vs OEM
ALTER TABLE bid.bid_checklists
    ADD COLUMN IF NOT EXISTS checklist_group VARCHAR(20) NOT NULL DEFAULT 'BIDDER'
    CHECK (checklist_group IN ('BIDDER', 'OEM', 'BID_DOC', 'CUSTOM'));

-- 4. Add OEM tracking table for Stage 3
CREATE TABLE IF NOT EXISTS bid.bid_oem_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id          UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    oem_name        TEXT NOT NULL,
    identification  TEXT,
    initiated       BOOLEAN NOT NULL DEFAULT false,
    maf_received    BOOLEAN NOT NULL DEFAULT false,
    mii_status      VARCHAR(30) DEFAULT 'PENDING',
    status          VARCHAR(30) DEFAULT 'PENDING',
    remarks         TEXT,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bid_oem_entries_bid ON bid.bid_oem_entries(bid_id);

-- 5. Add distributor quotes table for Stage 4 pricing
CREATE TABLE IF NOT EXISTS bid.bid_distributor_quotes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id             UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    distributor_name   TEXT NOT NULL,
    purchase_price     NUMERIC(15,2),
    quantity           INT DEFAULT 1,
    response_received  BOOLEAN NOT NULL DEFAULT false,
    created_by         UUID REFERENCES auth.users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bid_distributor_quotes_bid ON bid.bid_distributor_quotes(bid_id);

-- 6. Purge all old test tenders and seed fresh data
TRUNCATE TABLE public.alerts CASCADE;
TRUNCATE TABLE bid.bid_oem_entries CASCADE;
TRUNCATE TABLE bid.bid_distributor_quotes CASCADE;
TRUNCATE TABLE bid.bid_stage_history CASCADE;
TRUNCATE TABLE bid.bid_checklists CASCADE;
TRUNCATE TABLE bid.bid_workspace_members CASCADE;
TRUNCATE TABLE bid.bid_workspaces CASCADE;

-- 7. Delete non-system users (keep Sadmin only — admin adds rest)
DELETE FROM auth.user_roles 
WHERE user_id NOT IN (
    SELECT id FROM auth.users WHERE username = 'Sadmin'
);
DELETE FROM auth.users WHERE username != 'Sadmin';

-- 8. Ensure Sadmin is seeded cleanly
INSERT INTO auth.users (employee_code, username, email, full_name, password_hash, force_password_change, is_active)
VALUES ('SA001', 'Sadmin', 'biswabhusans@globx.co.in', 'Biswa SuperAdmin', 
        '$2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK', false, true)
ON CONFLICT (username) DO UPDATE SET
    email = 'biswabhusans@globx.co.in',
    password_hash = '$2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK',
    is_active = true,
    force_password_change = false;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u, auth.roles r 
WHERE u.username = 'Sadmin' AND r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
