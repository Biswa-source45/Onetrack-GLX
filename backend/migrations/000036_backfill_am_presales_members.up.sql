-- Migration 000036: Backfill Account Manager / Pre-Sales team membership
--
-- Reassigning the Account Manager or Pre-Sales person via Update (e.g. from
-- Primary Review's "Assign Pre-Sales") fired the "you've been assigned" alert
-- but never added a bid_workspace_members row, so that person silently never
-- showed up in the tender's Members tab. Application code now keeps
-- membership in sync on every reassignment (see UpdateBid); this backfills
-- every tender that already drifted before that fix shipped.

INSERT INTO bid.bid_workspace_members (bid_id, user_id, role, added_by)
SELECT id, account_manager_id, 'ACCOUNT_MANAGER', created_by
FROM bid.bid_workspaces
WHERE account_manager_id IS NOT NULL
ON CONFLICT (bid_id, user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO bid.bid_workspace_members (bid_id, user_id, role, added_by)
SELECT id, presales_id, 'PRESALES', created_by
FROM bid.bid_workspaces
WHERE presales_id IS NOT NULL
ON CONFLICT (bid_id, user_id) DO UPDATE SET role = EXCLUDED.role;
