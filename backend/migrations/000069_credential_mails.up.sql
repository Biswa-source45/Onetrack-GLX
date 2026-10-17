-- Migration 000069: bulk "Alert users" credential mails.
--
-- A Super Admin mails login details (or a "you reset your password" confirmation) to many users at once.
-- A batch is one click of Send; each row is one mail. The rows are what remembers "already alerted", so an
-- admin never mails the same person twice by accident. The password itself is never stored.
--
-- Only one batch may run at a time: the partial unique index below makes a second INSERT of a RUNNING batch
-- fail, so no lock is needed (and none can deadlock).
CREATE TABLE IF NOT EXISTS auth.credential_mail_batches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status      TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'DONE', 'FAILED')),
    total       INT  NOT NULL DEFAULT 0,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS credential_mail_one_running
    ON auth.credential_mail_batches ((true)) WHERE status = 'RUNNING';

CREATE TABLE IF NOT EXISTS auth.credential_mails (
    id       BIGSERIAL PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES auth.credential_mail_batches(id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind     TEXT NOT NULL CHECK (kind IN ('INITIAL', 'RESET_CONFIRM')),
    email    TEXT NOT NULL,
    status   TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    error    TEXT NOT NULL DEFAULT '',
    sent_at  TIMESTAMPTZ,
    UNIQUE (batch_id, user_id)
);

CREATE INDEX IF NOT EXISTS credential_mails_user_sent
    ON auth.credential_mails (user_id, kind) WHERE status = 'SENT';
