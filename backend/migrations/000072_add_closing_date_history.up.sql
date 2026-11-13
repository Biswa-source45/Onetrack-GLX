-- Migration 000072: add closing_date_history and closing_date_change_count to bid.bid_workspaces
-- Tracks how many times and by whom the tender end date / closing date has been edited.
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS closing_date_history JSONB NOT NULL DEFAULT '[]';

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS closing_date_change_count INT NOT NULL DEFAULT 0;
