-- Migration 000032 (down): restore the original bid_status constraint.
-- Any tender left on CLOSED must first move to a status the old check allows,
-- otherwise adding the constraint back would fail.
UPDATE bid.bid_workspaces SET bid_status = 'CANCELLED' WHERE bid_status = 'CLOSED';

ALTER TABLE bid.bid_workspaces
    DROP CONSTRAINT IF EXISTS bid_workspaces_bid_status_check;

ALTER TABLE bid.bid_workspaces
    ADD CONSTRAINT bid_workspaces_bid_status_check
    CHECK (bid_status IN ('ACTIVE', 'CANCELLED', 'ARCHIVED', 'WON', 'LOST'));
