-- Migration 000033 (down): remove quantity and our_rank.
DROP INDEX IF EXISTS bid.idx_bid_workspaces_our_rank;
ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS quantity,
    DROP COLUMN IF EXISTS our_rank;
