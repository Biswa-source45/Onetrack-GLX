-- Migration 000059: Live-testing trigger units, scheduler cadence unit and task escalation

-- 1. Scheduler cadence unit (scheduler_interval_value stays as is: existing rows are minutes) and
--    the wall-clock delay between the red-zone trigger and escalating a still-pending task.
ALTER TABLE calendar.working_calendars
    ADD COLUMN IF NOT EXISTS scheduler_interval_unit VARCHAR(10) NOT NULL DEFAULT 'MINUTES',
    ADD COLUMN IF NOT EXISTS escalation_delay_hours INT NOT NULL DEFAULT 4;

ALTER TABLE calendar.working_calendars DROP CONSTRAINT IF EXISTS chk_working_calendars_scheduler_interval_unit;
ALTER TABLE calendar.working_calendars
    ADD CONSTRAINT chk_working_calendars_scheduler_interval_unit CHECK (scheduler_interval_unit IN ('SECONDS', 'MINUTES'));

ALTER TABLE calendar.working_calendars DROP CONSTRAINT IF EXISTS chk_working_calendars_escalation_delay_hours;
ALTER TABLE calendar.working_calendars
    ADD CONSTRAINT chk_working_calendars_escalation_delay_hours CHECK (escalation_delay_hours BETWEEN 1 AND 720);

-- 2. The deadline trigger unit may now also be SECONDS or MINUTES. Replace any existing
--    CHECK that restricts it (whatever it is named) with one allowing all four units.
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'calendar.working_calendars'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%deadline_trigger_unit%'
    LOOP
        EXECUTE format('ALTER TABLE calendar.working_calendars DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE calendar.working_calendars
    ADD CONSTRAINT chk_working_calendars_deadline_trigger_unit CHECK (deadline_trigger_unit IN ('SECONDS', 'MINUTES', 'HOURS', 'DAYS'));

-- 3. Task escalations to the reporting manager. The partial unique index is the dedup claim:
--    a (tender, checklist) pair is escalated once. (A row whose checklist was deleted keeps its
--    NULL checklist_id as history and is deliberately not unique, so deleting checklists never fails.)
CREATE TABLE IF NOT EXISTS calendar.task_escalations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id         UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    checklist_id      UUID REFERENCES bid.bid_checklists(id) ON DELETE SET NULL,
    manager_user_id   UUID NOT NULL REFERENCES auth.users(id),
    escalation_reason TEXT NOT NULL,
    escalated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status            VARCHAR(20) NOT NULL DEFAULT 'ESCALATED',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_task_escalations_tender_checklist
    ON calendar.task_escalations (tender_id, checklist_id) WHERE checklist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_escalations_tender ON calendar.task_escalations (tender_id);
