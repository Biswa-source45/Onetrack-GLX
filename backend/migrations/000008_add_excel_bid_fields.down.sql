-- Migration 000008: Rollback excel bulk upload & tracking columns

ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS team,
    DROP COLUMN IF EXISTS scope_type,
    DROP COLUMN IF EXISTS bg_rate,
    DROP COLUMN IF EXISTS activity_type,
    DROP COLUMN IF EXISTS target_month_date,
    DROP COLUMN IF EXISTS excel_bid_status,
    DROP COLUMN IF EXISTS submission_status,
    DROP COLUMN IF EXISTS financial_evaluation_status,
    DROP COLUMN IF EXISTS po_received_status,
    DROP COLUMN IF EXISTS bid_result;
