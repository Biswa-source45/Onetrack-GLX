package domain

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// ErrTenderNotFound means the tender is missing, archived, submitted or has no closing date.
var ErrTenderNotFound = errors.New("tender not found or not eligible for deadline tracking")

// Holiday Types
const (
	HolidayTypeGovernment = "GOVERNMENT"
	HolidayTypeCompany    = "COMPANY"
	HolidayTypeRegional   = "REGIONAL"
	HolidayTypeOptional   = "OPTIONAL"
	HolidayTypeSpecial    = "SPECIAL"
)

// Working Statuses
const (
	WorkingStatusNonWorking = "NON_WORKING"
	WorkingStatusWorking    = "WORKING"
	WorkingStatusOptional   = "OPTIONAL"
)

// Priorities
const (
	PriorityHigh   = "HIGH"
	PriorityMedium = "MEDIUM"
	PriorityLow    = "LOW"
)

// Exception Types
const (
	ExceptionSpecialWorkingDay    = "SPECIAL_WORKING_DAY"
	ExceptionSpecialNonWorkingDay = "SPECIAL_NON_WORKING_DAY"
)

// Sources
const (
	SourceAdmin          = "ADMIN"
	SourceGoogleCalendar = "GOOGLE_CALENDAR"
)

// NotificationTypeRedZoneDueDate is the dedup key for the working-deadline alert.
const NotificationTypeRedZoneDueDate = "RED_ZONE_72H"

// Deadline trigger units. A HOURS value is hours / 24 working days (72h = 3,
// 48h = 2, 36h = 1.5); the fractional part is measured in that calendar's
// working hours. DAYS is that many working days. SECONDS and MINUTES are real
// working time taken off the closing time through the working-hours engine.
const (
	TriggerUnitSeconds = "SECONDS"
	TriggerUnitMinutes = "MINUTES"
	TriggerUnitHours   = "HOURS"
	TriggerUnitDays    = "DAYS"
	// MaxTriggerDays bounds the trigger so the SQL pre-filter window and day scans stay finite.
	MaxTriggerDays = 60

	maxTriggerSeconds = 86400
	maxTriggerMinutes = 43200
)

// Scheduler cadence units and the cadence used when none (or an invalid one) is stored.
const (
	SchedulerUnitSeconds     = "SECONDS"
	SchedulerUnitMinutes     = "MINUTES"
	DefaultSchedulerInterval = 10 * time.Minute
)

// Who started an evaluation.
const (
	RunTriggerScheduler = "SCHEDULER"
	RunTriggerManual    = "MANUAL"
)

// Red-zone outcomes reported per tender by an evaluation.
const (
	OutcomeNotified        = "NOTIFIED"
	OutcomeAlreadyNotified = "ALREADY_NOTIFIED"
	OutcomeBaselined       = "BASELINED"
	OutcomeFailed          = "FAILED"
)

// MaxRedZoneEntries caps the per-tender detail returned by one evaluation.
const MaxRedZoneEntries = 25

type WorkingCalendar struct {
	ID                   string  `json:"id"`
	Name                 string  `json:"name"`
	Description          *string `json:"description,omitempty"`
	IsDefault            bool    `json:"is_default"`
	Timezone             string  `json:"timezone"`
	WorkingStartTime     string  `json:"working_start_time"` // "09:00"
	WorkingEndTime       string  `json:"working_end_time"`   // "18:00"
	Saturday1Working     bool    `json:"saturday_1_working"`
	Saturday2Working     bool    `json:"saturday_2_working"` // Default: false (holiday)
	Saturday3Working     bool    `json:"saturday_3_working"`
	Saturday4Working     bool    `json:"saturday_4_working"` // Default: false (holiday)
	Saturday5Working     bool    `json:"saturday_5_working"`
	SundayWorking        bool    `json:"sunday_working"` // Default: false
	MondayWorking        bool    `json:"monday_working"`
	TuesdayWorking       bool    `json:"tuesday_working"`
	WednesdayWorking     bool    `json:"wednesday_working"`
	ThursdayWorking      bool    `json:"thursday_working"`
	FridayWorking        bool    `json:"friday_working"`
	DeadlineTriggerValue float64 `json:"deadline_trigger_value"`
	DeadlineTriggerUnit  string  `json:"deadline_trigger_unit"` // SECONDS, MINUTES, HOURS or DAYS
	// SchedulerIntervalValue is the evaluation cadence, in SchedulerIntervalUnit (SECONDS or MINUTES).
	SchedulerIntervalValue int    `json:"scheduler_interval_value"`
	SchedulerIntervalUnit  string `json:"scheduler_interval_unit"`
	// EscalationDelayHours is how many wall-clock hours past the trigger a pending task waits before escalating.
	EscalationDelayHours int       `json:"escalation_delay_hours"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// SchedulerInterval is the evaluation cadence; an invalid stored pair falls back to the default.
func (c *WorkingCalendar) SchedulerInterval() time.Duration {
	u, err := ValidateInterval(c.SchedulerIntervalValue, c.SchedulerIntervalUnit)
	if err != nil {
		return DefaultSchedulerInterval
	}
	if u == SchedulerUnitSeconds {
		return time.Duration(c.SchedulerIntervalValue) * time.Second
	}
	return time.Duration(c.SchedulerIntervalValue) * time.Minute
}

// ValidateInterval checks a scheduler cadence and returns the normalised unit.
func ValidateInterval(value int, unit string) (string, error) {
	u := strings.ToUpper(strings.TrimSpace(unit))
	switch {
	case u == "":
		u = SchedulerUnitMinutes
		fallthrough
	case u == SchedulerUnitMinutes:
		if value < 1 || value > 1440 {
			return "", fmt.Errorf("scheduler interval must be between 1 and 1440 minutes")
		}
	case u == SchedulerUnitSeconds:
		if value < 5 || value > 3600 {
			return "", fmt.Errorf("scheduler interval must be between 5 and 3600 seconds")
		}
	default:
		return "", fmt.Errorf("scheduler interval unit must be SECONDS or MINUTES")
	}
	return u, nil
}

type Holiday struct {
	ID               string     `json:"id"`
	CalendarID       string     `json:"calendar_id"`
	HolidayDate      string     `json:"holiday_date"` // YYYY-MM-DD
	HolidayName      string     `json:"holiday_name"`
	HolidayType      string     `json:"holiday_type"`
	WorkingStatus    string     `json:"working_status"`
	Priority         string     `json:"priority"`
	Source           string     `json:"source"`
	SourceEventID    *string    `json:"source_event_id,omitempty"`
	SourceCalendarID *string    `json:"source_calendar_id,omitempty"`
	IsAdminOverride  bool       `json:"is_admin_override"`
	IsActive         bool       `json:"is_active"`
	Description      *string    `json:"description,omitempty"`
	CreatedBy        *string    `json:"created_by,omitempty"`
	UpdatedBy        *string    `json:"updated_by,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	LastSyncedAt     *time.Time `json:"last_synced_at,omitempty"`
}

type CalendarException struct {
	ID            string    `json:"id"`
	CalendarID    string    `json:"calendar_id"`
	ExceptionDate string    `json:"exception_date"` // YYYY-MM-DD
	ExceptionType string    `json:"exception_type"` // SPECIAL_WORKING_DAY, SPECIAL_NON_WORKING_DAY
	Reason        string    `json:"reason"`
	CreatedBy     *string   `json:"created_by,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type GoogleCalendarIntegration struct {
	ID                 string     `json:"id"`
	CalendarID         string     `json:"calendar_id"`
	GoogleCalendarID   string     `json:"google_calendar_id"`
	GoogleCalendarName string     `json:"google_calendar_name"`
	APIKey             *string    `json:"api_key,omitempty"` // cleared before any response; clients see APIKeySet/APIKeyHint
	APIKeySet          bool       `json:"api_key_set"`
	APIKeyHint         string     `json:"api_key_hint,omitempty"` // last 4 characters
	SyncEnabled        bool       `json:"sync_enabled"`
	SyncIntervalHours  int        `json:"sync_interval_hours"`
	LastSyncAt         *time.Time `json:"last_sync_at,omitempty"`
	SyncStatus         string     `json:"sync_status"`
	LastError          *string    `json:"last_error,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// DefaultGoogleCalendarID is the public Indian holidays feed used until an admin configures another.
const DefaultGoogleCalendarID = "en.indian#holiday@group.v.calendar.google.com"

// DefaultIntegration is the unsaved Google sync configuration of a calendar that has none yet.
func DefaultIntegration(calendarID string) *GoogleCalendarIntegration {
	return &GoogleCalendarIntegration{
		CalendarID:         calendarID,
		GoogleCalendarID:   DefaultGoogleCalendarID,
		GoogleCalendarName: "Indian National Holidays",
		SyncEnabled:        true,
		SyncIntervalHours:  24,
		SyncStatus:         "IDLE",
	}
}

type GoogleCalendarSyncLog struct {
	ID            string    `json:"id"`
	IntegrationID string    `json:"integration_id"`
	Status        string    `json:"status"` // SUCCESS, FAILED
	ImportedCount int       `json:"imported_count"`
	UpdatedCount  int       `json:"updated_count"`
	SkippedCount  int       `json:"skipped_count"`
	FailedCount   int       `json:"failed_count"`
	ErrorDetails  *string   `json:"error_details,omitempty"`
	SyncedBy      *string   `json:"synced_by,omitempty"`
	SyncedByName  *string   `json:"synced_by_name,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type TaskNotification struct {
	ID               string    `json:"id"`
	TenderID         string    `json:"tender_id"`
	RecipientUserID  string    `json:"recipient_user_id"`
	RecipientRole    *string   `json:"recipient_role,omitempty"`
	NotificationType string    `json:"notification_type"`
	ScheduledAt      time.Time `json:"scheduled_at"`
	Subject          string    `json:"subject"`
	Message          string    `json:"message"`
}

type TenderStakeholder struct {
	UserID   string `json:"user_id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Roles    string `json:"roles"` // Consolidated list of roles, e.g. "Bid Owner, Team Member"
}

type RedZoneNotificationResult struct {
	TenderID              string              `json:"tender_id"`
	TenderTitle           string              `json:"tender_title"`
	ClosingDate           time.Time           `json:"closing_date"`
	Calculated72hDeadline time.Time           `json:"calculated_72h_deadline"`
	RemainingWorkingHours float64             `json:"remaining_working_hours"`
	RemainingWorkingDays  float64             `json:"remaining_working_days"`
	StakeholdersNotified  []TenderStakeholder `json:"stakeholders_notified"`
	DeliveryStatus        string              `json:"delivery_status"` // SENT, ALREADY_SENT, NOT_IN_RED_ZONE, FAILED
	TriggeredAt           time.Time           `json:"triggered_at"`
	Message               string              `json:"message"`
}

// EvaluationSummary reports what one scheduler/manual evaluation did.
type EvaluationSummary struct {
	Baselined bool `json:"baselined"` // first run: in-window tenders were recorded as already notified, nothing sent
	Evaluated int  `json:"evaluated"`
	InRedZone int  `json:"in_red_zone"`
	Notified  int  `json:"notified"`  // recipients alerted (capped per run)
	Skipped   bool `json:"skipped"`   // another instance holds the evaluation lock
	Escalated int  `json:"escalated"` // delayed tasks escalated to a reporting manager (counts toward the per-run cap)
	// WindowDays is how far ahead of now the engine looked for closing dates.
	WindowDays int              `json:"window_days"`
	Coverage   DeadlineCoverage `json:"coverage"`
	RedZone    []RedZoneEntry   `json:"red_zone"` // capped at MaxRedZoneEntries
}

// DeadlineCoverage explains where every active tender sits, so "0 evaluated" is
// never a mystery. The five buckets after TotalActive partition it.
type DeadlineCoverage struct {
	TotalActive         int `json:"total_active"`
	NoClosingDate       int `json:"no_closing_date"`
	AlreadyClosed       int `json:"already_closed"`
	SubmittedOrResolved int `json:"submitted_or_resolved"` // still open, but excluded by the engine's eligibility rule
	BeyondWindow        int `json:"beyond_window"`
	InWindow            int `json:"in_window"`
}

type RedZoneEntry struct {
	TenderID    string    `json:"tender_id"`
	Title       string    `json:"title"`
	Deadline    time.Time `json:"deadline"`
	ClosingDate time.Time `json:"closing_date"`
	Outcome     string    `json:"outcome"` // NOTIFIED, ALREADY_NOTIFIED, BASELINED, FAILED
}

// LastRun is the most recent evaluation by any caller, kept in memory only.
type LastRun struct {
	At      time.Time          `json:"at"`
	Trigger string             `json:"trigger"` // SCHEDULER or MANUAL
	Error   string             `json:"error"`
	Summary *EvaluationSummary `json:"summary"`
}

// EngineRuntime is what the service knows about the engine's recent activity.
type EngineRuntime struct {
	NextRunAt *time.Time
	LastRun   *LastRun
}

type CalculateDeadlineResult struct {
	TargetWorkingValue    float64   `json:"target_working_value"`
	TargetWorkingUnit     string    `json:"target_working_unit"`
	CalculatedDeadline    time.Time `json:"calculated_deadline"`
	RemainingWorkingHours float64   `json:"remaining_working_hours"`
	RemainingWorkingDays  float64   `json:"remaining_working_days"` // remaining hours / working day length
	WorkingDayHours       float64   `json:"working_day_hours"`
	IsThresholdReached    bool      `json:"is_threshold_reached"`
}

type NextActionableTask struct {
	ChecklistID    string     `json:"checklist_id"`
	Title          string     `json:"title"`
	Priority       string     `json:"priority"` // HIGH, MEDIUM, LOW
	AssignedToID   *string    `json:"assigned_to_id,omitempty"`
	AssignedToName *string    `json:"assigned_to_name,omitempty"`
	AssignedRole   *string    `json:"assigned_role,omitempty"`
	SortOrder      int        `json:"sort_order"`
	DueAt          *time.Time `json:"due_at,omitempty"`
	Status         string     `json:"status"`
}

// DTO Requests

// UpdateCalendarRequest is a partial update: nil fields keep the stored value,
// so a partial PUT can never flip omitted working days off.
type UpdateCalendarRequest struct {
	Name                   *string  `json:"name"`
	Description            *string  `json:"description"`
	WorkingStartTime       *string  `json:"working_start_time"`
	WorkingEndTime         *string  `json:"working_end_time"`
	Saturday1Working       *bool    `json:"saturday_1_working"`
	Saturday2Working       *bool    `json:"saturday_2_working"`
	Saturday3Working       *bool    `json:"saturday_3_working"`
	Saturday4Working       *bool    `json:"saturday_4_working"`
	Saturday5Working       *bool    `json:"saturday_5_working"`
	SundayWorking          *bool    `json:"sunday_working"`
	MondayWorking          *bool    `json:"monday_working"`
	TuesdayWorking         *bool    `json:"tuesday_working"`
	WednesdayWorking       *bool    `json:"wednesday_working"`
	ThursdayWorking        *bool    `json:"thursday_working"`
	FridayWorking          *bool    `json:"friday_working"`
	DeadlineTriggerValue   *float64 `json:"deadline_trigger_value"`
	DeadlineTriggerUnit    *string  `json:"deadline_trigger_unit"`
	SchedulerIntervalValue *int     `json:"scheduler_interval_value"`
	SchedulerIntervalUnit  *string  `json:"scheduler_interval_unit"` // SECONDS or MINUTES
	EscalationDelayHours   *int     `json:"escalation_delay_hours"`
}

var hmPattern = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

// ValidateTrigger checks a deadline trigger and returns the normalised unit.
func ValidateTrigger(value float64, unit string) (string, error) {
	u := strings.ToUpper(strings.TrimSpace(unit))
	if u == "" {
		u = TriggerUnitHours
	}
	switch u {
	case TriggerUnitSeconds:
		if value < 1 || value > maxTriggerSeconds {
			return "", fmt.Errorf("trigger must be between 1 and %d seconds", maxTriggerSeconds)
		}
	case TriggerUnitMinutes:
		if value < 1 || value > maxTriggerMinutes {
			return "", fmt.Errorf("trigger must be between 1 and %d minutes", maxTriggerMinutes)
		}
	case TriggerUnitHours, TriggerUnitDays:
		if value <= 0 || TriggerDays(value, u) > MaxTriggerDays {
			return "", fmt.Errorf("trigger value must be greater than 0 and at most %d working days", MaxTriggerDays)
		}
	default:
		return "", fmt.Errorf("trigger unit must be SECONDS, MINUTES, HOURS or DAYS")
	}
	return u, nil
}

// TriggerDays converts a HOURS or DAYS trigger value to working days; SECONDS and
// MINUTES are working time, not days, and are handled by the service.
func TriggerDays(value float64, unit string) float64 {
	if unit == TriggerUnitHours {
		return value / 24
	}
	return value
}

// Validate normalises the request in place and checks it against the stored calendar.
// Messages are safe to show to the admin.
func (r *UpdateCalendarRequest) Validate(cur *WorkingCalendar) error {
	if r.Name != nil {
		n := strings.TrimSpace(*r.Name)
		if n == "" {
			return fmt.Errorf("calendar name is required")
		}
		r.Name = &n
	}
	start, end := cur.WorkingStartTime, cur.WorkingEndTime
	if r.WorkingStartTime != nil {
		start = *r.WorkingStartTime
	}
	if r.WorkingEndTime != nil {
		end = *r.WorkingEndTime
	}
	if !hmPattern.MatchString(start) || !hmPattern.MatchString(end) {
		return fmt.Errorf("working hours must be in HH:MM format")
	}
	if end <= start { // zero-padded HH:MM compares lexically
		return fmt.Errorf("working end time must be after start time")
	}
	if r.DeadlineTriggerValue != nil || r.DeadlineTriggerUnit != nil {
		val, unit := cur.DeadlineTriggerValue, cur.DeadlineTriggerUnit
		if r.DeadlineTriggerValue != nil {
			val = *r.DeadlineTriggerValue
		}
		if r.DeadlineTriggerUnit != nil {
			unit = *r.DeadlineTriggerUnit
		}
		u, err := ValidateTrigger(val, unit)
		if err != nil {
			return err
		}
		if r.DeadlineTriggerUnit != nil {
			r.DeadlineTriggerUnit = &u
		}
	}
	if r.SchedulerIntervalValue != nil || r.SchedulerIntervalUnit != nil {
		val, unit := cur.SchedulerIntervalValue, cur.SchedulerIntervalUnit
		if r.SchedulerIntervalValue != nil {
			val = *r.SchedulerIntervalValue
		}
		if r.SchedulerIntervalUnit != nil {
			unit = *r.SchedulerIntervalUnit
		}
		u, err := ValidateInterval(val, unit)
		if err != nil {
			return err
		}
		if r.SchedulerIntervalUnit != nil {
			r.SchedulerIntervalUnit = &u
		}
	}
	if r.EscalationDelayHours != nil && (*r.EscalationDelayHours < 1 || *r.EscalationDelayHours > 720) {
		return fmt.Errorf("escalation delay must be between 1 and 720 hours")
	}
	return nil
}

type CreateHolidayRequest struct {
	HolidayDate   string  `json:"holiday_date" binding:"required"` // YYYY-MM-DD
	HolidayName   string  `json:"holiday_name" binding:"required"`
	HolidayType   string  `json:"holiday_type"`   // GOVERNMENT, COMPANY, etc.
	WorkingStatus string  `json:"working_status"` // NON_WORKING, WORKING, OPTIONAL
	Priority      string  `json:"priority"`       // HIGH, MEDIUM, LOW
	Description   *string `json:"description,omitempty"`
}

type UpdateHolidayRequest struct {
	HolidayName     *string `json:"holiday_name,omitempty"`
	HolidayType     *string `json:"holiday_type,omitempty"`
	WorkingStatus   *string `json:"working_status,omitempty"`
	Priority        *string `json:"priority,omitempty"`
	IsActive        *bool   `json:"is_active,omitempty"`
	IsAdminOverride *bool   `json:"is_admin_override,omitempty"`
	Description     *string `json:"description,omitempty"`
}

type CreateExceptionRequest struct {
	ExceptionDate string `json:"exception_date" binding:"required"` // YYYY-MM-DD
	ExceptionType string `json:"exception_type" binding:"required"` // SPECIAL_WORKING_DAY, SPECIAL_NON_WORKING_DAY
	Reason        string `json:"reason" binding:"required"`
}

type ConfigureGoogleSyncRequest struct {
	GoogleCalendarID   string  `json:"google_calendar_id" binding:"required"`
	GoogleCalendarName string  `json:"google_calendar_name"`
	APIKey             *string `json:"api_key,omitempty"` // empty or a masked placeholder keeps the stored key
	SyncEnabled        bool    `json:"sync_enabled"`
	SyncIntervalHours  int     `json:"sync_interval_hours"`
}

type SyncResult struct {
	Status        string `json:"status"`
	ImportedCount int    `json:"imported_count"`
	UpdatedCount  int    `json:"updated_count"`
	SkippedCount  int    `json:"skipped_count"`
	FailedCount   int    `json:"failed_count"`
	Message       string `json:"message"`
}

type UpdateChecklistPriorityRequest struct {
	Priority     string  `json:"priority" binding:"required"` // HIGH, MEDIUM, LOW
	AssignedToID *string `json:"assigned_to_id,omitempty"`
	AssignedRole *string `json:"assigned_role,omitempty"`
}
