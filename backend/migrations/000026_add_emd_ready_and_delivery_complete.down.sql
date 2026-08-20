-- Rollback Migration 000026
ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS emd_ready_date,
    DROP COLUMN IF EXISTS delivery_complete,
    DROP COLUMN IF EXISTS delivery_complete_date;
