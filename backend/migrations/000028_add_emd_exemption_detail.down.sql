-- Rollback Migration 000028
ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS emd_exemption_type,
    DROP COLUMN IF EXISTS emd_exemption_reason;
