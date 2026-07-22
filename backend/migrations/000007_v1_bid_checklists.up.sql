-- Migration 000007: V1 beta — add technical_manager_id and bid-scoped checklists

-- 1. Technical manager as a first-class field on the bid
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS technical_manager_id UUID REFERENCES auth.users(id);

-- 2. Bid-scoped checklists (simpler than task checklists — owned directly by the bid)
CREATE TABLE bid.bid_checklists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id      UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    is_done     BOOLEAN NOT NULL DEFAULT false,
    done_by     UUID REFERENCES auth.users(id),
    done_at     TIMESTAMPTZ,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_checklists_bid ON bid.bid_checklists(bid_id);
