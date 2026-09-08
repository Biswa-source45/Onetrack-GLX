-- Migration 000037: Add Tender's "Additional Info / Challenge" note
--
-- Adds alert_note (raw JSON string — {text, label, color}), the same
-- unvalidated-JSONB pattern as requested_products/primary_review, since the
-- tender-identification email that needs to render it is built server-side.
-- Also fixes the "Servilance" category misspelling, both going forward (the
-- frontend's option list) and on any tender already saved with the old
-- spelling, so it doesn't fork into two entries in category filters.

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS alert_note JSONB DEFAULT NULL;

UPDATE bid.bid_workspaces
SET category = 'Surveillance'
WHERE category = 'Servilance';
