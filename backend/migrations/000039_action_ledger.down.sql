-- Migration 000039 rollback
-- Note: reverting bid_id to NOT NULL will fail if any row has already gone
-- NULL via a permanent delete since this migration applied — that data loss
-- is inherent to rolling back the fix, not a bug in the rollback itself.

DROP INDEX IF EXISTS bid.idx_bid_stage_history_actor;
DROP INDEX IF EXISTS bid.idx_bid_stage_history_created_at;

ALTER TABLE bid.bid_stage_history
    DROP COLUMN IF EXISTS bid_title;

ALTER TABLE bid.bid_stage_history
    DROP CONSTRAINT bid_stage_history_bid_id_fkey,
    ADD CONSTRAINT bid_stage_history_bid_id_fkey
        FOREIGN KEY (bid_id) REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE;

ALTER TABLE bid.bid_stage_history
    ALTER COLUMN bid_id SET NOT NULL;
