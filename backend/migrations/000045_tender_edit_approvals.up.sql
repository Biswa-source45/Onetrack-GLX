-- A Bid Executive's Edit-Tender-form submission held for that tender's
-- Reporting Manager to approve, correct, or reject before it lands.
CREATE TABLE bid.tender_edit_approvals (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id                UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    requested_by          UUID NOT NULL REFERENCES auth.users(id),
    reporting_manager_id  UUID NOT NULL REFERENCES auth.users(id),
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    payload               JSONB NOT NULL,
    diff                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    decided_payload       JSONB,
    decision_diff         JSONB,
    decision_comment      TEXT,
    decided_by            UUID REFERENCES auth.users(id),
    decided_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tender_edit_approvals_bid ON bid.tender_edit_approvals(bid_id);
CREATE INDEX idx_tender_edit_approvals_rm_status ON bid.tender_edit_approvals(reporting_manager_id, status);

-- One open proposal per tender at a time, so a Reporting Manager is never
-- asked to reconcile two overlapping edits.
CREATE UNIQUE INDEX idx_tender_edit_approvals_one_pending ON bid.tender_edit_approvals(bid_id) WHERE status = 'PENDING';
