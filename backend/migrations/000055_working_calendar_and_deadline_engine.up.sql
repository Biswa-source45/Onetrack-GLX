-- Migration 000055: Working Calendar, Google Holiday Synchronization, and 72-Hour Deadline Engine

CREATE SCHEMA IF NOT EXISTS calendar;

-- 1. Working Calendars table
CREATE TABLE IF NOT EXISTS calendar.working_calendars (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(100) NOT NULL UNIQUE,
    description             TEXT,
    is_default              BOOLEAN NOT NULL DEFAULT false,
    timezone                VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    working_start_time      VARCHAR(5) NOT NULL DEFAULT '09:00',
    working_end_time        VARCHAR(5) NOT NULL DEFAULT '18:00',
    -- Saturday rules: 2nd and 4th Saturday are holidays by default; 1st, 3rd, 5th are working
    saturday_1_working      BOOLEAN NOT NULL DEFAULT true,
    saturday_2_working      BOOLEAN NOT NULL DEFAULT false,
    saturday_3_working      BOOLEAN NOT NULL DEFAULT true,
    saturday_4_working      BOOLEAN NOT NULL DEFAULT false,
    saturday_5_working      BOOLEAN NOT NULL DEFAULT true,
    -- Weekly days
    sunday_working          BOOLEAN NOT NULL DEFAULT false,
    monday_working          BOOLEAN NOT NULL DEFAULT true,
    tuesday_working         BOOLEAN NOT NULL DEFAULT true,
    wednesday_working       BOOLEAN NOT NULL DEFAULT true,
    thursday_working        BOOLEAN NOT NULL DEFAULT true,
    friday_working          BOOLEAN NOT NULL DEFAULT true,
    -- Delay escalation threshold (hours after 72h trigger)
    escalation_delay_hours  INT NOT NULL DEFAULT 4,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default Corporate Calendar
INSERT INTO calendar.working_calendars (
    name, description, is_default, timezone, working_start_time, working_end_time,
    saturday_1_working, saturday_2_working, saturday_3_working, saturday_4_working, saturday_5_working,
    sunday_working, monday_working, tuesday_working, wednesday_working, thursday_working, friday_working
) VALUES (
    'Corporate Working Calendar',
    'Standard company calendar: Mon-Fri working, 1st/3rd/5th Sat working, 2nd/4th Sat & Sun non-working (09:00-18:00)',
    true, 'Asia/Kolkata', '09:00', '18:00',
    true, false, true, false, true,
    false, true, true, true, true, true
) ON CONFLICT (name) DO NOTHING;

-- 2. Holidays table
CREATE TABLE IF NOT EXISTS calendar.holidays (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id         UUID NOT NULL REFERENCES calendar.working_calendars(id) ON DELETE CASCADE,
    holiday_date        DATE NOT NULL,
    holiday_name        VARCHAR(255) NOT NULL,
    holiday_type        VARCHAR(50) NOT NULL DEFAULT 'GOVERNMENT', -- GOVERNMENT, COMPANY, REGIONAL, OPTIONAL, SPECIAL
    working_status      VARCHAR(20) NOT NULL DEFAULT 'NON_WORKING', -- NON_WORKING, WORKING, OPTIONAL
    priority            VARCHAR(20) NOT NULL DEFAULT 'HIGH', -- HIGH, MEDIUM, LOW
    source              VARCHAR(50) NOT NULL DEFAULT 'ADMIN', -- ADMIN, GOOGLE_CALENDAR
    source_event_id     VARCHAR(255),
    source_calendar_id  VARCHAR(255),
    is_admin_override   BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    description         TEXT,
    created_by          UUID REFERENCES auth.users(id),
    updated_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at      TIMESTAMPTZ,
    CONSTRAINT uq_calendar_date_name UNIQUE (calendar_id, holiday_date, holiday_name)
);

CREATE INDEX IF NOT EXISTS idx_calendar_holidays_date ON calendar.holidays(calendar_id, holiday_date);

-- 3. Calendar Special Exceptions (Special working days & special non-working days)
CREATE TABLE IF NOT EXISTS calendar.calendar_exceptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id         UUID NOT NULL REFERENCES calendar.working_calendars(id) ON DELETE CASCADE,
    exception_date      DATE NOT NULL,
    exception_type      VARCHAR(50) NOT NULL, -- SPECIAL_WORKING_DAY, SPECIAL_NON_WORKING_DAY
    reason              TEXT NOT NULL,
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_calendar_exception_date UNIQUE (calendar_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date ON calendar.calendar_exceptions(calendar_id, exception_date);

-- 4. Google Calendar Integration config table
CREATE TABLE IF NOT EXISTS calendar.google_calendar_integrations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id             UUID NOT NULL REFERENCES calendar.working_calendars(id) ON DELETE CASCADE,
    google_calendar_id      VARCHAR(255) NOT NULL DEFAULT 'en.indian#holiday@group.v.calendar.google.com',
    google_calendar_name    VARCHAR(255) NOT NULL DEFAULT 'Indian National Holidays',
    api_key                 VARCHAR(255),
    sync_enabled            BOOLEAN NOT NULL DEFAULT true,
    sync_interval_hours     INT NOT NULL DEFAULT 24,
    last_sync_at            TIMESTAMPTZ,
    sync_status             VARCHAR(50) NOT NULL DEFAULT 'IDLE', -- IDLE, SYNCING, SUCCESS, FAILED
    last_error              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_google_integration_calendar UNIQUE (calendar_id)
);

-- Seed default Google Calendar integration
INSERT INTO calendar.google_calendar_integrations (
    calendar_id, google_calendar_id, google_calendar_name, api_key, sync_enabled
)
SELECT id, 'en.indian#holiday@group.v.calendar.google.com', 'Indian National Holidays', 'AIzaSyCDcz24H7RhwsgfqpKxYB4N53cbIo5DF1A', true
FROM calendar.working_calendars
WHERE is_default = true
ON CONFLICT (calendar_id) DO UPDATE
SET api_key = EXCLUDED.api_key;

-- 5. Google Calendar Sync Logs
CREATE TABLE IF NOT EXISTS calendar.google_calendar_sync_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES calendar.google_calendar_integrations(id) ON DELETE CASCADE,
    status          VARCHAR(50) NOT NULL, -- SUCCESS, FAILED
    imported_count  INT NOT NULL DEFAULT 0,
    updated_count   INT NOT NULL DEFAULT 0,
    skipped_count   INT NOT NULL DEFAULT 0,
    failed_count    INT NOT NULL DEFAULT 0,
    error_details   TEXT,
    synced_by       UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Link Tenders to Working Calendar
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES calendar.working_calendars(id),
    ADD COLUMN IF NOT EXISTS calculated_72h_deadline TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deadline_remaining_working_hours NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS deadline_last_computed_at TIMESTAMPTZ;

-- Backfill existing bids to default calendar
UPDATE bid.bid_workspaces
SET calendar_id = (SELECT id FROM calendar.working_calendars WHERE is_default = true LIMIT 1)
WHERE calendar_id IS NULL;

-- 7. Enhance Checklists with priority, role, assignment, and status
ALTER TABLE bid.bid_checklists
    ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(50),
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- 8. Task Notifications tracking (Idempotent 72h reminders and alerts)
CREATE TABLE IF NOT EXISTS calendar.task_notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id           UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    checklist_id        UUID REFERENCES bid.bid_checklists(id) ON DELETE SET NULL,
    recipient_user_id   UUID NOT NULL REFERENCES auth.users(id),
    notification_type   VARCHAR(50) NOT NULL, -- 72_HOUR_REMINDER, TASK_DELAY, ESCALATION, EMD_ALERT
    scheduled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at             TIMESTAMPTZ,
    delivery_status     VARCHAR(20) NOT NULL DEFAULT 'SENT', -- PENDING, SENT, FAILED
    subject             TEXT NOT NULL,
    message             TEXT NOT NULL,
    error_message       TEXT,
    retry_count         INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notification_tender_type_checklist UNIQUE (tender_id, checklist_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_task_notifications_tender ON calendar.task_notifications(tender_id, notification_type);

-- 9. Task Escalations tracking
CREATE TABLE IF NOT EXISTS calendar.task_escalations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id           UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    checklist_id        UUID REFERENCES bid.bid_checklists(id) ON DELETE SET NULL,
    manager_user_id     UUID NOT NULL REFERENCES auth.users(id),
    escalation_reason   TEXT NOT NULL,
    escalated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              VARCHAR(20) NOT NULL DEFAULT 'ESCALATED', -- ESCALATED, RESOLVED, ACKNOWLEDGED
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Seed Core 2026/2027 Indian Public Holidays into Default Calendar
DO $$
DECLARE
    def_cal_id UUID;
BEGIN
    SELECT id INTO def_cal_id FROM calendar.working_calendars WHERE is_default = true LIMIT 1;
    IF def_cal_id IS NOT NULL THEN
        INSERT INTO calendar.holidays (calendar_id, holiday_date, holiday_name, holiday_type, working_status, priority, source) VALUES
            (def_cal_id, '2026-01-26', 'Republic Day', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-03-04', 'Holi', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-03-21', 'Id-ul-Fitr', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-04-03', 'Good Friday', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-04-14', 'Dr. B.R. Ambedkar Jayanti', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-05-01', 'May Day / Labor Day', 'COMPANY', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-05-27', 'Bakrid / Eid al-Adha', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-08-15', 'Independence Day', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-09-04', 'Janmashtami', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-10-02', 'Mahatma Gandhi Jayanti', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-10-20', 'Dussehra / Vijayadashami', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-11-08', 'Diwali / Deepavali', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-11-24', 'Guru Nanak Jayanti', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2026-12-25', 'Christmas Day', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2027-01-26', 'Republic Day', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2027-08-15', 'Independence Day', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN'),
            (def_cal_id, '2027-10-02', 'Mahatma Gandhi Jayanti', 'GOVERNMENT', 'NON_WORKING', 'HIGH', 'ADMIN')
        ON CONFLICT (calendar_id, holiday_date, holiday_name) DO NOTHING;
    END IF;
END $$;

-- 11. Seed Permissions for Working Calendar
INSERT INTO auth.permissions (resource, action, description) VALUES
    ('calendar', 'view', 'Allows viewing working calendar, holidays, and 72-hour deadlines'),
    ('calendar', 'edit', 'Allows configuring working calendar, holidays, exceptions, and Google sync')
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;

-- Grant permissions to roles:
-- SUPER_ADMIN & ADMIN: view + edit
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
  AND p.resource = 'calendar'
ON CONFLICT DO NOTHING;

-- MANAGER, BID_EXECUTIVE, PRE_SALES, FINANCE: view
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE r.name IN ('MANAGER', 'BID_EXECUTIVE', 'PRE_SALES', 'FINANCE')
  AND p.resource = 'calendar' AND p.action = 'view'
ON CONFLICT DO NOTHING;
