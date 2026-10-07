-- Migration 000056: Red Zone Stakeholder Notification Engine & Constraints
-- Supports notifying all involved stakeholders for a tender's 72 working-hour due date notification

-- 1. Add recipient_role column to calendar.task_notifications for role-based tracking
ALTER TABLE calendar.task_notifications
    ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(100);

-- 2. Drop the old restrictive unique constraint if present
ALTER TABLE calendar.task_notifications
    DROP CONSTRAINT IF EXISTS uq_notification_tender_type_checklist;

-- 3. Create unique index allowing multiple stakeholders per tender while preventing duplicate alerts to the same user
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_notifications_tender_recipient_type
    ON calendar.task_notifications (tender_id, recipient_user_id, notification_type)
    WHERE checklist_id IS NULL;

-- 4. Helpful index for recipient lookup
CREATE INDEX IF NOT EXISTS idx_task_notifications_recipient_id
    ON calendar.task_notifications (recipient_user_id);
