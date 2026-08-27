-- Migration 000030: Add "No EMD" (EMD Not Applicable) to bid.bid_workspaces
-- Distinct from emd_exempted: emd_exempted means the tender DOES require an
-- EMD but the bidder is excused from paying it (MSME/Startup/Other cert).
-- emd_not_applicable means the tender itself has NO EMD clause at all — a
-- plain tender-level fact, nothing to certify. The two are mutually exclusive.

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS emd_not_applicable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bid.bid_workspaces
    ADD CONSTRAINT chk_emd_exempted_not_applicable_exclusive
    CHECK (NOT (emd_exempted AND emd_not_applicable));
