-- Migration 000061: post-bid contacts
--
-- One JSONB on the tender for the Bid Submission stage hand-off to Finance:
-- {submittedAt, submittedBy, financeUserId, financeUserName, assignedAt, assignedBy,
--  contacts: {payment|oem|accounts|customer|customerFinance: [{name, org, phone, email}]},
--  na: [group keys marked not applicable], doneAt, doneBy}
-- Written through PATCH /bids/:id like primary_review; the stage cannot be
-- completed until doneAt is set (checked in the bid service).
ALTER TABLE bid.bid_workspaces ADD COLUMN IF NOT EXISTS post_bid JSONB DEFAULT NULL;
