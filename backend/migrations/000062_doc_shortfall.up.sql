-- Migration 000062: document shortfall requests during Technical Evaluation
--
-- One JSONB on the tender: {rounds: [{n, status, deadline, raisedAt, raisedBy, docs: [...],
--  approverId, approverName, approvedAt, approvedBy, respondedAt, outcome, ...}]}.
-- A round walks COLLECTING -> PENDING_APPROVAL -> APPROVED -> SUBMITTED and its
-- outcome records what the re-evaluation decided. Written through PATCH /bids/:id
-- like post_bid; the bid service enforces who may approve and blocks the
-- Technical Evaluation result while a round is still open.
ALTER TABLE bid.bid_workspaces ADD COLUMN IF NOT EXISTS doc_shortfall JSONB DEFAULT NULL;
