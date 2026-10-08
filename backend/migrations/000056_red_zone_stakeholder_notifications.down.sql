-- Revert migration 000056
DROP INDEX IF EXISTS calendar.uq_task_notifications_tender_recipient_type;
DROP INDEX IF EXISTS calendar.idx_task_notifications_recipient_id;

ALTER TABLE calendar.task_notifications
    DROP COLUMN IF EXISTS recipient_role;
