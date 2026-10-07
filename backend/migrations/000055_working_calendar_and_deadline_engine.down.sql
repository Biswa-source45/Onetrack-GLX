-- Migration 000055 Down: Revert Working Calendar and Deadline Engine

ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS calendar_id,
    DROP COLUMN IF EXISTS calculated_72h_deadline,
    DROP COLUMN IF EXISTS deadline_remaining_working_hours,
    DROP COLUMN IF EXISTS deadline_last_computed_at;

ALTER TABLE bid.bid_checklists
    DROP COLUMN IF EXISTS priority,
    DROP COLUMN IF EXISTS assigned_to,
    DROP COLUMN IF EXISTS assigned_role,
    DROP COLUMN IF EXISTS due_at,
    DROP COLUMN IF EXISTS status;

DROP TABLE IF EXISTS calendar.task_escalations;
DROP TABLE IF EXISTS calendar.task_notifications;
DROP TABLE IF EXISTS calendar.google_calendar_sync_logs;
DROP TABLE IF EXISTS calendar.google_calendar_integrations;
DROP TABLE IF EXISTS calendar.calendar_exceptions;
DROP TABLE IF EXISTS calendar.holidays;
DROP TABLE IF EXISTS calendar.working_calendars;

DELETE FROM auth.role_permissions
WHERE permission_id IN (SELECT id FROM auth.permissions WHERE resource = 'calendar');

DELETE FROM auth.permissions WHERE resource = 'calendar';

DROP SCHEMA IF EXISTS calendar CASCADE;
