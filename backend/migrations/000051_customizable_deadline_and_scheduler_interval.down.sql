-- Migration 000051 Down: Revert customizable deadline trigger & scheduler interval

ALTER TABLE calendar.working_calendars
    DROP COLUMN IF EXISTS deadline_trigger_value,
    DROP COLUMN IF EXISTS deadline_trigger_unit,
    DROP COLUMN IF EXISTS scheduler_interval_value,
    DROP COLUMN IF EXISTS scheduler_interval_unit;
