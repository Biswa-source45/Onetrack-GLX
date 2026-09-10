-- Migration 000039: Action Ledger — survivable, paginated audit trail.
--
-- Two problems fixed:
--
-- 1. bid_stage_history.bid_id was ON DELETE CASCADE, so permanently deleting
--    a tender deleted its own audit trail with it — including the entry
--    recording that it was deleted. GetGlobalAuditLogs already had a
--    COALESCE(b.title, 'Deleted Bid') fallback for an orphaned row, which the
--    CASCADE made unreachable dead code; this migration is what makes that
--    path real. bid_id now sets NULL instead, and bid_title is denormalized
--    at write time so an orphaned entry still shows a readable tender name.
--
-- 2. No index supported keyset ("cursor") pagination. Every tender edit is
--    about to start writing a row here (not just stage transitions), so the
--    table needs to page efficiently well past the sizes it's seen so far.

ALTER TABLE bid.bid_stage_history
    ALTER COLUMN bid_id DROP NOT NULL;

ALTER TABLE bid.bid_stage_history
    DROP CONSTRAINT bid_stage_history_bid_id_fkey,
    ADD CONSTRAINT bid_stage_history_bid_id_fkey
        FOREIGN KEY (bid_id) REFERENCES bid.bid_workspaces(id) ON DELETE SET NULL;

ALTER TABLE bid.bid_stage_history
    ADD COLUMN IF NOT EXISTS bid_title TEXT;

UPDATE bid.bid_stage_history h
SET bid_title = b.title
FROM bid.bid_workspaces b
WHERE h.bid_id = b.id AND h.bid_title IS NULL;

-- Keyset pagination: the global and per-person feeds order by
-- (created_at, id) DESC; the per-person feed additionally filters by actor.
CREATE INDEX IF NOT EXISTS idx_bid_stage_history_created_at
    ON bid.bid_stage_history (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_bid_stage_history_actor
    ON bid.bid_stage_history (transitioned_by, created_at DESC, id DESC);
