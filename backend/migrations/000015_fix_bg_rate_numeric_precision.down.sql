-- Migration 000015 down: Revert bg_rate column precision

ALTER TABLE bid.bid_workspaces
    ALTER COLUMN bg_rate TYPE NUMERIC(5, 4);
