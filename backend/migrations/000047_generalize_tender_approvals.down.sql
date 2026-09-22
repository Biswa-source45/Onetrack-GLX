ALTER TABLE bid.tender_edit_approvals ALTER COLUMN payload SET NOT NULL;
ALTER TABLE bid.tender_edit_approvals DROP COLUMN action_type;
