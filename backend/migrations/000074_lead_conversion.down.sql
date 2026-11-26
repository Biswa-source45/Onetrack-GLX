ALTER TABLE leads.leads
    DROP COLUMN IF EXISTS converted_bid_id,
    DROP COLUMN IF EXISTS converted_at;
