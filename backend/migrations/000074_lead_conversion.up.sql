-- Migration 000074: Lead -> Tender conversion.
--
-- A lead marked Go is converted into a tender once. converted_at is also the
-- claim that stops two clicks creating two tenders. If the tender is later
-- deleted for good, the link clears and the lead can be converted again.
ALTER TABLE leads.leads
    ADD COLUMN IF NOT EXISTS converted_bid_id UUID REFERENCES bid.bid_workspaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS converted_at     TIMESTAMPTZ;
