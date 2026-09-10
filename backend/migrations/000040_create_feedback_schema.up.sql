-- Migration 000040: Feedback Loop — a ticket every user can raise, that only
-- Super Admin triages. Two tables, same shape as the audit-trail pattern
-- already used elsewhere (bid.bid_stage_history): the ticket itself, and a
-- small append-only history of its status changes.

CREATE SCHEMA IF NOT EXISTS feedback;

CREATE TABLE feedback.tickets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id),
    category         TEXT NOT NULL,
    custom_category  TEXT,        -- set only when category = 'Other'
    description      TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'OPEN',
    resolved_by      UUID REFERENCES auth.users(id),
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE feedback.ticket_status_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES feedback.tickets(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status   TEXT NOT NULL,
    changed_by  UUID REFERENCES auth.users(id),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Super Admin's ticket list filters by status and orders newest-first; the
-- Feedback tab's "My Tickets" scopes by reporter the same way.
CREATE INDEX idx_tickets_status_created ON feedback.tickets (status, created_at DESC, id DESC);
CREATE INDEX idx_tickets_user_created ON feedback.tickets (user_id, created_at DESC, id DESC);
CREATE INDEX idx_ticket_status_history_ticket ON feedback.ticket_status_history (ticket_id, created_at ASC);
