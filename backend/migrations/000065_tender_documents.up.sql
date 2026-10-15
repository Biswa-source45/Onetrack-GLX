-- Migration 000065: tender documents
--
-- Every tender carries a set of named documents (RFP, ATC, Corrigendum, ...).
-- Files live on disk under <TENDER_DOCS_UPLOAD_DIR>/<docs_folder>/<Name>/<file>;
-- docs_folder is chosen once (title slug + random suffix) and never changes, so
-- editing the title later does not move or orphan files. Old tenders get their
-- folder lazily, on the first upload.
ALTER TABLE bid.bid_workspaces ADD COLUMN IF NOT EXISTS docs_folder TEXT;

CREATE TABLE IF NOT EXISTS bid.tender_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id        UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    -- The label the user typed or picked ("RFP", "ATC", ...).
    name          TEXT NOT NULL,
    original_name TEXT NOT NULL,
    -- Path relative to the tender's docs_folder, e.g. "RFP/a1b2c3d4_rfp.pdf".
    stored_path   TEXT NOT NULL,
    content_type  TEXT NOT NULL,
    size_bytes    BIGINT NOT NULL,
    uploaded_by   UUID REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_documents_bid ON bid.tender_documents (bid_id, created_at);
