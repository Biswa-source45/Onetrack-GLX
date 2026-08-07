-- Migration 000018: Ensure checklist_group column exists on bid.bid_checklists

ALTER TABLE bid.bid_checklists
    ADD COLUMN IF NOT EXISTS checklist_group VARCHAR(20) NOT NULL DEFAULT 'BIDDER';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bid_checklists_checklist_group_check'
    ) THEN
        ALTER TABLE bid.bid_checklists
            ADD CONSTRAINT bid_checklists_checklist_group_check
            CHECK (checklist_group IN ('BIDDER', 'OEM', 'BID_DOC', 'CUSTOM'));
    END IF;
END $$;
