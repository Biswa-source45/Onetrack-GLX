-- Migration 000023: Add EMD Bank/DD Detail Columns to bid.bid_workspaces
-- These columns store the payment details for Online (bank transfer) and DD EMD modes.
-- All fields are nullable — they are only filled when the corresponding EMD mode is selected.

ALTER TABLE bid.bid_workspaces
    -- Online Payment fields
    ADD COLUMN IF NOT EXISTS emd_bank_name       TEXT          DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_account_number  TEXT          DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_ifsc_code       TEXT          DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_branch          TEXT          DEFAULT NULL,
    -- DD (Demand Draft) fields
    ADD COLUMN IF NOT EXISTS emd_beneficiary     TEXT          DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_payable_at      TEXT          DEFAULT NULL;

-- Index for queries filtering by EMD type with bank details
CREATE INDEX IF NOT EXISTS idx_bids_emd_type ON bid.bid_workspaces(emd_type) WHERE emd_type IS NOT NULL;
