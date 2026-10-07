-- Migration 000057: Customizable Tender Deadline Trigger & Background Scheduler Cadence

-- 1. Add customizable deadline threshold and unit to calendar.working_calendars
ALTER TABLE calendar.working_calendars
    ADD COLUMN IF NOT EXISTS deadline_trigger_value NUMERIC(10, 2) NOT NULL DEFAULT 72.0,
    ADD COLUMN IF NOT EXISTS deadline_trigger_unit VARCHAR(20) NOT NULL DEFAULT 'HOURS',
    ADD COLUMN IF NOT EXISTS scheduler_interval_value INT NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS scheduler_interval_unit VARCHAR(20) NOT NULL DEFAULT 'MINUTES';

-- Ensure default corporate calendar has explicit baseline settings
UPDATE calendar.working_calendars
SET deadline_trigger_value = COALESCE(deadline_trigger_value, 72.0),
    deadline_trigger_unit = COALESCE(deadline_trigger_unit, 'HOURS'),
    scheduler_interval_value = COALESCE(scheduler_interval_value, 10),
    scheduler_interval_unit = COALESCE(scheduler_interval_unit, 'MINUTES')
WHERE is_default = true;
