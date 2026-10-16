DROP TABLE IF EXISTS leads.lead_prebid_items;

ALTER TABLE leads.leads
    DROP COLUMN IF EXISTS prebid_sent_at,
    DROP COLUMN IF EXISTS prebid_assignee_id,
    DROP COLUMN IF EXISTS prebid_stage;
