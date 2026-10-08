-- Migration 000059 Down: Revert live-testing units and task escalation

DROP TABLE IF EXISTS calendar.task_escalations;

ALTER TABLE calendar.working_calendars DROP CONSTRAINT IF EXISTS chk_working_calendars_deadline_trigger_unit;
ALTER TABLE calendar.working_calendars DROP CONSTRAINT IF EXISTS chk_working_calendars_scheduler_interval_unit;
ALTER TABLE calendar.working_calendars DROP CONSTRAINT IF EXISTS chk_working_calendars_escalation_delay_hours;

-- Rows using the new units fall back to the old defaults.
UPDATE calendar.working_calendars SET deadline_trigger_unit = 'HOURS', deadline_trigger_value = 72
    WHERE deadline_trigger_unit IN ('SECONDS', 'MINUTES');

ALTER TABLE calendar.working_calendars
    DROP COLUMN IF EXISTS scheduler_interval_unit,
    DROP COLUMN IF EXISTS escalation_delay_hours;
