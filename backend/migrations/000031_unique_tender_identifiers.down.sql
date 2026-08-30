-- Migration 000031 (down): drop the tender identifier uniqueness backstop.
DROP INDEX IF EXISTS bid.idx_bid_workspaces_gem_bid_no_unique;
DROP INDEX IF EXISTS bid.idx_bid_workspaces_bid_no_unique;
