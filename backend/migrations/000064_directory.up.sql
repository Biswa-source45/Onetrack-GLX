-- Migration 000064: My Accounts (Account Managers) and My OEMs (Pre-Sales)
--
-- One private list per person and kind: an Account Manager keeps the accounts they manage, a
-- Pre-Sales person keeps their OEMs; each record holds any number of contacts. Rows are only ever
-- read or written by their owner (the API filters on owner_id), so nothing here is shared.
CREATE SCHEMA IF NOT EXISTS directory;

CREATE TABLE IF NOT EXISTS directory.entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind       TEXT NOT NULL CHECK (kind IN ('ACCOUNT', 'OEM')),
    owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    sector     TEXT NOT NULL DEFAULT '',
    location   TEXT NOT NULL DEFAULT '',
    website    TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One person cannot hold the same account / OEM twice (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_entries_owner_kind_name
    ON directory.entries (owner_id, kind, lower(name));

CREATE TABLE IF NOT EXISTS directory.contacts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id    UUID NOT NULL REFERENCES directory.entries(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    designation TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    phone       TEXT NOT NULL DEFAULT '',
    remarks     TEXT NOT NULL DEFAULT '',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directory_contacts_entry ON directory.contacts (entry_id, sort_order, created_at);
