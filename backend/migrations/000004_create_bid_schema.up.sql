-- Migration 000004: Create bid schema and tables
-- Supports both MANUAL and INTELLIGENCE creation modes

CREATE SCHEMA IF NOT EXISTS bid;

-- Primary aggregate root: Bid Workspace
CREATE TABLE bid.bid_workspaces (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity & Reference
    bid_no                      VARCHAR(150),
    gem_bid_no                  VARCHAR(150),
    title                       TEXT NOT NULL,
    organization_name           TEXT,
    department_name             TEXT,
    portal_source               VARCHAR(50) NOT NULL DEFAULT 'GeM',

    -- Creation mode (drives initialization path, NOT lifecycle)
    -- MANUAL: form-filled by operator
    -- INTELLIGENCE: AI-extracted from uploaded document
    creation_mode               VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
                                CHECK (creation_mode IN ('MANUAL', 'INTELLIGENCE')),

    -- Workflow lifecycle state (shared by both modes)
    workflow_stage              VARCHAR(50) NOT NULL DEFAULT 'DISCOVERED',
    bid_status                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                                CHECK (bid_status IN ('ACTIVE', 'CANCELLED', 'ARCHIVED', 'WON', 'LOST')),

    -- Ownership
    bid_owner_id                UUID NOT NULL REFERENCES auth.users(id),
    created_by                  UUID NOT NULL REFERENCES auth.users(id),

    -- Financial fields (from Excel tracker)
    estimated_value             NUMERIC(15, 2),
    emd_amount                  NUMERIC(15, 2),
    emd_type                    VARCHAR(50),
    emd_exempted                BOOLEAN NOT NULL DEFAULT false,
    final_bid_value             NUMERIC(15, 2),
    l1_price                    NUMERIC(15, 2),
    quoted_price                NUMERIC(15, 2),

    -- Dates
    opening_date                TIMESTAMPTZ,
    closing_date                TIMESTAMPTZ,
    submission_date             TIMESTAMPTZ,
    result_date                 TIMESTAMPTZ,
    ra_date                     TIMESTAMPTZ,

    -- Categorization
    category                    VARCHAR(150),
    bid_type                    VARCHAR(50),
    gem_bid_type                VARCHAR(100),
    oem_required                BOOLEAN NOT NULL DEFAULT false,
    has_tech_eval               BOOLEAN NOT NULL DEFAULT false,

    -- Outcome tracking
    qualification_status        VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    bid_outcome                 VARCHAR(30)
                                CHECK (bid_outcome IN ('WON', 'LOST', 'CANCELLED', NULL)),
    outcome_reason              TEXT,
    tech_compliance_status      VARCHAR(30),

    -- Additional tracking
    remarks                     TEXT,
    competitor_info             JSONB NOT NULL DEFAULT '[]',
    metadata                    JSONB NOT NULL DEFAULT '{}',

    -- AI-mode fields (NULL for MANUAL, populated for INTELLIGENCE)
    ai_source_document_id       UUID,
    ai_extraction_confidence    NUMERIC(5, 4),

    -- Timestamps
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at                 TIMESTAMPTZ
);

-- Workspace membership (role-based access within a bid)
CREATE TABLE bid.bid_workspace_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id      UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id),
    role        VARCHAR(30) NOT NULL DEFAULT 'MEMBER'
                CHECK (role IN ('OWNER', 'MANAGER', 'MEMBER', 'REVIEWER', 'OBSERVER')),
    added_by    UUID REFERENCES auth.users(id),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bid_id, user_id)
);

-- Immutable stage transition history
CREATE TABLE bid.bid_stage_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id              UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    from_stage          VARCHAR(50),
    to_stage            VARCHAR(50) NOT NULL,
    transition_reason   TEXT,
    transitioned_by     UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_bid_workspaces_bid_owner ON bid.bid_workspaces(bid_owner_id);
CREATE INDEX idx_bid_workspaces_workflow_stage ON bid.bid_workspaces(workflow_stage);
CREATE INDEX idx_bid_workspaces_bid_status ON bid.bid_workspaces(bid_status);
CREATE INDEX idx_bid_workspaces_creation_mode ON bid.bid_workspaces(creation_mode);
CREATE INDEX idx_bid_workspaces_closing_date ON bid.bid_workspaces(closing_date);
CREATE INDEX idx_bid_workspaces_created_at ON bid.bid_workspaces(created_at DESC);
CREATE INDEX idx_bid_workspaces_title ON bid.bid_workspaces USING gin(to_tsvector('english', title));
CREATE INDEX idx_bid_workspace_members_bid ON bid.bid_workspace_members(bid_id);
CREATE INDEX idx_bid_workspace_members_user ON bid.bid_workspace_members(user_id);
CREATE INDEX idx_bid_stage_history_bid ON bid.bid_stage_history(bid_id);
