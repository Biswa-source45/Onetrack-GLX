-- Migration 000070: when a user's password last changed (self change, OTP reset, or an admin force-reset).
--
-- The bulk "Alert users" tab counts a user as already alerted only if the mail was sent AFTER the current
-- password was set; so when an admin force-resets someone to a new password, that user can be alerted again
-- with the new one. NULL (existing rows) means "unknown": any earlier mail still counts.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
