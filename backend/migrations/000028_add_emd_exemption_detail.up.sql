-- Migration 000028: Add EMD Exemption Type/Reason to bid.bid_workspaces
-- Records *why* a tender is EMD-exempt (MSME / Startup / Other + free-text reason).
-- Nullable — only meaningful when emd_exempted = true.

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS emd_exemption_type   VARCHAR(20)
        CHECK (emd_exemption_type IN ('MSME', 'STARTUP', 'OTHER')),
    ADD COLUMN IF NOT EXISTS emd_exemption_reason  TEXT DEFAULT NULL;
