DROP TABLE IF EXISTS leads.lead_events;

ALTER TABLE leads.leads
    DROP COLUMN IF EXISTS approver_id,
    DROP COLUMN IF EXISTS stage;
