-- Where the tender was discovered (portal / notice URL). Optional; http(s) only,
-- enforced in the service layer.
ALTER TABLE bid.bid_workspaces ADD COLUMN IF NOT EXISTS tender_link TEXT;
