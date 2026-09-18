-- Migration 000041: Stage-Level Access Control + System Logs.
--
-- bid.user_stage_restrictions — a per-user, per-workflow-stage lock. One row
-- means this user cannot view/act on that stage of any tender they touch. No
-- row for a stage means no restriction. Only ever written for BID_EXECUTIVE
-- users (enforced in the service layer, not here) — every other role stays
-- structurally exempt. Mirrors the shape of auth.user_permission_overrides.

-- restricted_by is nullable for the same reason as system_events.actor_id
-- below: it must not block deleting the admin who set a restriction.
CREATE TABLE IF NOT EXISTS bid.user_stage_restrictions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workflow_stage TEXT NOT NULL,
    restricted_by  UUID REFERENCES auth.users(id),
    restricted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, workflow_stage)
);

CREATE INDEX IF NOT EXISTS idx_user_stage_restrictions_user
    ON bid.user_stage_restrictions (user_id);

-- auth.system_events — the account/permission-layer audit trail. Tender
-- activity already has its own ledger (bid.bid_stage_history); this table
-- covers what that one doesn't: user creation, role changes, permission
-- overrides, and stage-access toggles. Read-only from the app's point of
-- view (SUPER_ADMIN's "System Logs" page) — written only by the services
-- whose mutations it's describing.

-- actor_id and target_user_id are both nullable, same convention as
-- bid_stage_history.transitioned_by (migration 000012): the app's user
-- Delete already clears every FK column pointing at auth.users by hand
-- before the row is actually removed (Postgres FKs here carry no ON DELETE
-- clause), and a deleted actor/target renders as "Deleted user" via
-- COALESCE at read time — see user/repository/postgres.go's Delete.
CREATE TABLE IF NOT EXISTS auth.system_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category       TEXT NOT NULL,
    event_type     TEXT NOT NULL,
    actor_id       UUID REFERENCES auth.users(id),
    target_user_id UUID REFERENCES auth.users(id),
    summary        TEXT NOT NULL,
    details        JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_created_at
    ON auth.system_events (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_category
    ON auth.system_events (category, created_at DESC);
