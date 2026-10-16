-- Migration 000067: per-user preferences (e.g. whether Tenders opens as cards or as the sheet).
--
-- One row per user holding a small JSON object of their own choices. The set of keys and the values each
-- may take are checked by the API (internal/preferences), so a new preference needs no migration.
CREATE TABLE IF NOT EXISTS auth.user_preferences (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    prefs      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
