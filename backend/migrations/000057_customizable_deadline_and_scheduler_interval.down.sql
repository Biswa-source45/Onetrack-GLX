-- Migration 000057 Down: Revert customizable deadline trigger, scheduler interval & engine baseline

DROP TABLE IF EXISTS calendar.engine_baseline;

ALTER TABLE calendar.working_calendars
    DROP COLUMN IF EXISTS deadline_trigger_value,
    DROP COLUMN IF EXISTS deadline_trigger_unit,
    DROP COLUMN IF EXISTS scheduler_interval_value;
