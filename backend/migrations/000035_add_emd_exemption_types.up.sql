-- Migration 000035: EMD exemption types raw capture
--
-- The tender document can list more than one EMD exemption criterion as
-- acceptable (e.g. both MSME and Startup). emd_exemption_type/reason stay as
-- the Account Manager's single final decision (set in Primary Review); this
-- new array column is the raw, possibly-multiple set ticked by the executive
-- at Add/Edit Tender time, off the tender document itself.
-- Nullable (like the sibling requested_products/primary_review JSONB columns)
-- rather than NOT NULL, since bid creation happens through several code paths
-- (manual add, bulk import, AI extraction) and only one of them populates this.
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS emd_exemption_types TEXT[] DEFAULT NULL;
