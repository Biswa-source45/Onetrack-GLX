-- Migration 000052: let a tender be closed by hand, with a reason.
--
-- 000032 added CLOSED to bid_status for bulk-imported tenders, but bid_outcome
-- (what the outcome endpoint writes, alongside outcome_reason) still only
-- accepted WON / LOST / CANCELLED - so "Close Tender" had nowhere to record
-- itself.

ALTER TABLE bid.bid_workspaces
    DROP CONSTRAINT IF EXISTS bid_workspaces_bid_outcome_check;

ALTER TABLE bid.bid_workspaces
    ADD CONSTRAINT bid_workspaces_bid_outcome_check
    CHECK (bid_outcome IN ('WON', 'LOST', 'CANCELLED', 'CLOSED'));
