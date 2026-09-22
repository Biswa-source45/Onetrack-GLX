-- Generalizes bid.tender_edit_approvals (previously Edit-only) to also hold
-- pending Cancel and Delete requests, so a Bid Executive can't route around
-- Reporting-Manager approval by cancelling or deleting instead of editing.
ALTER TABLE bid.tender_edit_approvals
    ADD COLUMN action_type VARCHAR(20) NOT NULL DEFAULT 'EDIT'
        CHECK (action_type IN ('EDIT', 'CANCEL', 'DELETE'));

-- Cancel/Delete requests carry a small reason/mode payload, not a full
-- Edit-Tender-form submission — NOT NULL no longer holds for every row.
ALTER TABLE bid.tender_edit_approvals ALTER COLUMN payload DROP NOT NULL;
