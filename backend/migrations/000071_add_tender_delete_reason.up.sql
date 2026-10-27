-- Migration 000071: add delete_reason column to bid.bid_workspaces
-- Records why a tender was deleted / moved to the Tender Bin, displayed in the
-- Tender Bin, detail page banner, and approval workflows.
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS delete_reason TEXT;
