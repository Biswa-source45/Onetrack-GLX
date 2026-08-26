-- Rollback Migration 000029
ALTER TABLE bid.bid_workspaces RENAME COLUMN reporting_manager_id TO technical_manager_id;
