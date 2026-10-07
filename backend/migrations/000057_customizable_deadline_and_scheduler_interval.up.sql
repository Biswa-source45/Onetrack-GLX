-- Migration 000057: Customizable Tender Deadline Trigger, Scheduler Cadence & Engine Baseline

-- 1. Deadline trigger (HOURS = value/24 working days, or DAYS) and scheduler cadence in minutes
ALTER TABLE calendar.working_calendars
    ADD COLUMN IF NOT EXISTS deadline_trigger_value NUMERIC(10, 2) NOT NULL DEFAULT 72.0,
    ADD COLUMN IF NOT EXISTS deadline_trigger_unit VARCHAR(20) NOT NULL DEFAULT 'HOURS',
    ADD COLUMN IF NOT EXISTS scheduler_interval_value INT NOT NULL DEFAULT 10;

-- 2. One-time baseline marker. The first evaluation records tenders already inside
--    the red-zone window as notified (without sending); once this row exists the
--    engine notifies normally. The single-row constraint makes the insert idempotent.
CREATE TABLE IF NOT EXISTS calendar.engine_baseline (
    id           BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    baselined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
