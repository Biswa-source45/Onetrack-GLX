-- Migration 000008: Add excel bulk upload & tracking columns to bid.bid_workspaces

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS team                        TEXT,
    ADD COLUMN IF NOT EXISTS scope_type                  TEXT,
    ADD COLUMN IF NOT EXISTS bg_rate                     NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS activity_type               TEXT,
    ADD COLUMN IF NOT EXISTS target_month_date          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS excel_bid_status           TEXT,
    ADD COLUMN IF NOT EXISTS submission_status         TEXT,
    ADD COLUMN IF NOT EXISTS financial_evaluation_status TEXT,
    ADD COLUMN IF NOT EXISTS po_received_status         TEXT,
    ADD COLUMN IF NOT EXISTS bid_result                  TEXT;
