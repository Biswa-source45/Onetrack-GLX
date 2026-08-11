-- Migration 000019: Add pricing_workspace JSONB column to bid.bid_workspaces
-- Stores the complete Stage 4 pricing request workspace data (distributors, quotes, margin, phase)
-- so that it is visible to all authorized users and survives page reloads / browser changes.

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS pricing_workspace JSONB DEFAULT NULL;
