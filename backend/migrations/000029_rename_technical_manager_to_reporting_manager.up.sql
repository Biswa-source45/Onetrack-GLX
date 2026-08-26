-- Migration 000029: Rename technical_manager_id -> reporting_manager_id
-- The field is being repurposed/relabeled as "Reporting Manager" — the person
-- who should be alerted about a tender's progress, not strictly a technical role.
ALTER TABLE bid.bid_workspaces RENAME COLUMN technical_manager_id TO reporting_manager_id;
