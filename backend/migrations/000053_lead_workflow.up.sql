-- Migration 000053: Lead approval workflow.
--
--   created -> RM_REVIEW -> PENDING_APPROVAL -> APPROVED -> GO
--                 ^               |                 |
--                 +-- sent back --+                 |
--   NO_GO (cancelled, with a reason) is reachable from any stage before GO.
--
-- The Reporting Manager reviews a new lead and sends it to one chosen
-- approver (an Admin / Manager role holder); the approval comes back to the
-- Reporting Manager, who then decides Go or No-Go.

ALTER TABLE leads.leads
    ADD COLUMN stage TEXT NOT NULL DEFAULT 'RM_REVIEW'
        CHECK (stage IN ('RM_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'GO', 'NO_GO')),
    -- Who the lead was last sent to for approval. Kept after the decision
    -- so the lead still shows who approved it.
    ADD COLUMN approver_id UUID REFERENCES auth.users(id);

-- Every workflow step and edit, in order: the lead's own timeline, and the
-- LEAD source of the System Logs feed.
CREATE TABLE leads.lead_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES leads.leads(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES auth.users(id),
    event_type  TEXT NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_events_lead ON leads.lead_events (lead_id, created_at);
CREATE INDEX idx_lead_events_created ON leads.lead_events (created_at DESC, id DESC);
