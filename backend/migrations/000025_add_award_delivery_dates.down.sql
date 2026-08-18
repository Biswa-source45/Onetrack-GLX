-- Rollback Migration 000025
ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS po_received_date,
    DROP COLUMN IF EXISTS bg_target_date,
    DROP COLUMN IF EXISTS bg_discharged_date,
    DROP COLUMN IF EXISTS emd_returned_date;
