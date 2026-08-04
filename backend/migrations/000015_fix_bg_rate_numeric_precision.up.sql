-- Migration 000015: Fix bg_rate column precision to NUMERIC(15, 2)

ALTER TABLE bid.bid_workspaces
    ALTER COLUMN bg_rate TYPE NUMERIC(15, 2);
