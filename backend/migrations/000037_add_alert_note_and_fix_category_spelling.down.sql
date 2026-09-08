-- Migration 000037 rollback
-- Note: the "Servilance" -> "Surveillance" category data fix is not
-- reversible (the original misspelled values were not individually tracked).

ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS alert_note;
