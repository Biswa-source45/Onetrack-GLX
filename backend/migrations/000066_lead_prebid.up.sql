-- Migration 000066: Prebid queries on a lead.
--
-- Before bidding, the Account Manager (the lead owner) collects doubts about the RFP from
-- Pre-Sales, the Delivery Manager and the Bid Manager in one shared Product / OEM sheet, turns
-- them into queries for the customer, and tracks the customer's answers.
--
--   NOT_STARTED -> WITH_PM -> WITH_AM -> WITH_DM -> WITH_AM -> WITH_BM -> WITH_AM -> SENT -> CLOSED
--
-- The AM is the hub: the sheet always comes back to them, and they may send it to PM / DM / BM
-- in any order, more than once. It runs alongside the lead's approval stage and never blocks it.
-- Every step is also written to leads.lead_events (the lead timeline), so it needs no table here.

ALTER TABLE leads.leads
    ADD COLUMN prebid_stage TEXT NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (prebid_stage IN ('NOT_STARTED', 'WITH_PM', 'WITH_DM', 'WITH_BM', 'WITH_AM', 'SENT', 'CLOSED')),
    -- Who the sheet was last handed to; kept after they return it.
    ADD COLUMN prebid_assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN prebid_sent_at TIMESTAMPTZ;

-- One row per product / query, edited cell by cell so two people never overwrite each other.
CREATE TABLE leads.lead_prebid_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id           UUID NOT NULL REFERENCES leads.leads(id) ON DELETE CASCADE,
    clause_ref        TEXT NOT NULL DEFAULT '',
    product           TEXT NOT NULL DEFAULT '',
    oem               TEXT NOT NULL DEFAULT '',
    pm_remarks        TEXT NOT NULL DEFAULT '',
    dm_comment        TEXT NOT NULL DEFAULT '',
    bm_comment        TEXT NOT NULL DEFAULT '',
    query             TEXT NOT NULL DEFAULT '',
    customer_response TEXT NOT NULL DEFAULT '',
    sort_order        INT NOT NULL DEFAULT 0,
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_prebid_items_lead ON leads.lead_prebid_items (lead_id, sort_order, created_at);

-- The Delivery Manager is handed the sheet, so they must be able to open the lead. (Bid Manager
-- and Pre-Sales already hold lead.view.) Idempotent.
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
JOIN auth.permissions p ON p.resource = 'lead' AND p.action = 'view'
WHERE r.name = 'DELIVERY_MANAGER'
ON CONFLICT DO NOTHING;
