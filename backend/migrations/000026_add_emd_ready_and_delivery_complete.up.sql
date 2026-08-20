-- Migration 000026: Add EMD Ready date-tracking and a new "Delivery / Work
-- Complete" milestone to bid.bid_workspaces.
-- emd_ready already exists as a boolean but has no companion date; delivery
-- completion is a brand new milestone in the Award & Handover checklist.

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS emd_ready_date          TIMESTAMPTZ   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS delivery_complete        BOOLEAN       DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS delivery_complete_date   TIMESTAMPTZ   DEFAULT NULL;
