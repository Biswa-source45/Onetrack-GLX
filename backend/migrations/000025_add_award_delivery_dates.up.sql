-- Migration 000025: Add Award & Delivery date-tracking columns to bid.bid_workspaces
-- Restructured Award & Delivery flow needs to record *when* each milestone
-- happened, not just whether it happened (the existing boolean flags
-- po_received_status/bg_discharged/emd_returned only capture the latter).

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS po_received_date    TIMESTAMPTZ   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bg_target_date       TIMESTAMPTZ   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bg_discharged_date   TIMESTAMPTZ   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_returned_date    TIMESTAMPTZ   DEFAULT NULL;
