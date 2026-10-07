UPDATE bid.bid_workspaces SET bid_outcome = NULL WHERE bid_outcome = 'CLOSED';

ALTER TABLE bid.bid_workspaces
    DROP CONSTRAINT IF EXISTS bid_workspaces_bid_outcome_check;

ALTER TABLE bid.bid_workspaces
    ADD CONSTRAINT bid_workspaces_bid_outcome_check
    CHECK (bid_outcome IN ('WON', 'LOST', 'CANCELLED'));
