-- Migration 000020: Add oem_workspace JSONB column to bid.bid_workspaces
-- Stores Stage 3 OEM Authorization tracking sheet matrix data (OEM entries, MAF status, MII status, certificates, remarks)
-- so that it is maintained in the DB and visible to all authorized users (Admin, SuperAdmin, Manager, Bid Executive).

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS oem_workspace JSONB DEFAULT NULL;
