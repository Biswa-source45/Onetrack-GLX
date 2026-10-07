-- Migration 000051: Leads — a pre-tender pipeline (Lead -> Quote -> Bid)
-- kept in its own schema with no foreign keys into bid.*, so it can evolve
-- (and later convert into a tender) without touching the tender tables.

CREATE SCHEMA IF NOT EXISTS leads;

CREATE TABLE leads.leads (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- PUBLISHED: an RFP/tender is already out, so the tender-spec details
    -- (published_details) and documents apply. UNPUBLISHED: an early lead.
    publish_status        TEXT NOT NULL CHECK (publish_status IN ('PUBLISHED', 'UNPUBLISHED')),
    lead_type             TEXT NOT NULL CHECK (lead_type IN ('PVT', 'GOV')),

    account_name          TEXT NOT NULL,
    department_name       TEXT,
    location              TEXT,
    high_level_scope      TEXT,
    expected_date         DATE,
    scope_type            TEXT,
    category              TEXT,
    estimated_value       NUMERIC(15, 2),

    -- Tender title for a PUBLISHED lead (required then), NULL otherwise.
    title                 TEXT,
    -- Every other tender Section 1 field (RFP no, dates, portal, bid type,
    -- quantity, products, EMD, BG) for a PUBLISHED lead. JSONB because
    -- leads never filter on them, and the shape mirrors the tender form so
    -- a later Lead -> Bid conversion can hand it straight over.
    published_details     JSONB,

    lead_owner_id         UUID NOT NULL REFERENCES auth.users(id),
    reporting_manager_id  UUID REFERENCES auth.users(id),
    created_by            UUID NOT NULL REFERENCES auth.users(id),

    -- Server-generated "<slug>-<random>" folder under LEADS_UPLOAD_DIR;
    -- stored so renaming a lead never orphans its files.
    folder_name           TEXT NOT NULL UNIQUE,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_created ON leads.leads (created_at DESC);

CREATE TABLE leads.lead_documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id        UUID NOT NULL REFERENCES leads.leads(id) ON DELETE CASCADE,
    -- NULL for a bulk upload; the typed label ("RFP", "BOQ", ...) for a
    -- categorised one.
    category       TEXT,
    original_name  TEXT NOT NULL,
    -- Path relative to the lead's folder, e.g. "docs/RFP/a1b2c3d4_rfp.pdf".
    stored_path    TEXT NOT NULL,
    content_type   TEXT NOT NULL,
    size_bytes     BIGINT NOT NULL,
    uploaded_by    UUID REFERENCES auth.users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_documents_lead ON leads.lead_documents (lead_id, created_at);

-- Permissions: lead.view / lead.create, granted to every role that already
-- holds the matching tender permission, so the same people see Leads
-- without a manual role edit. Admins can tune them independently after.
INSERT INTO auth.permissions (resource, action, description) VALUES
    ('lead', 'view',   'Allows viewing the Leads dashboard and lead details'),
    ('lead', 'create', 'Allows adding leads and uploading lead documents')
ON CONFLICT DO NOTHING;

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT rp.role_id, lp.id
FROM auth.role_permissions rp
JOIN auth.permissions bp ON bp.id = rp.permission_id AND bp.resource = 'bid' AND bp.action IN ('view', 'create')
JOIN auth.permissions lp ON lp.resource = 'lead' AND lp.action = bp.action
ON CONFLICT DO NOTHING;
