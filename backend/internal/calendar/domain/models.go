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
// working hours. DAYS is that many working days.
const (
	TriggerUnitHours = "HOURS"
	TriggerUnitDays  = "DAYS"
	// MaxTriggerDays bounds the trigger so the SQL pre-filter window and day scans stay finite.
	MaxTriggerDays = 60
)

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
	DeadlineTriggerUnit  string  `json:"deadline_trigger_unit"` // HOURS or DAYS
	// SchedulerIntervalValue is the evaluation cadence in minutes.
	SchedulerIntervalValue int       `json:"scheduler_interval_value"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
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
	ID               string     `json:"id"`
	TenderID         string     `json:"tender_id"`
	RecipientUserID  string     `json:"recipient_user_id"`
	RecipientName    *string    `json:"recipient_name,omitempty"`
	RecipientEmail   *string    `json:"recipient_email,omitempty"`
	RecipientRole    *string    `json:"recipient_role,omitempty"`
	NotificationType string     `json:"notification_type"`
	ScheduledAt      time.Time  `json:"scheduled_at"`
	TriggeredAt      time.Time  `json:"triggered_at"`
	SentAt           *time.Time `json:"sent_at,omitempty"`
	DeliveryStatus   string     `json:"delivery_status"`
	Subject          string     `json:"subject"`
	Message          string     `json:"message"`
	ErrorMessage     *string    `json:"error_message,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
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
	Notified  int  `json:"notified"` // recipients alerted (capped per run)
	Skipped   bool `json:"skipped"`  // another instance holds the evaluation lock
}

type WorkingInterval struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

type SkippedDateInfo struct {
	Date   string `json:"date"`
	Reason string `json:"reason"`
}

type CalculateDeadlineResult struct {
	TenderID              string              `json:"tender_id,omitempty"`
	TenderTitle           string              `json:"tender_title,omitempty"`
	ClosingDate           time.Time           `json:"closing_date"`
	TargetWorkingHours    float64             `json:"target_working_hours"` // working hours the trigger spans (days x workday length)
	TargetWorkingDays     int                 `json:"target_working_days"`
	TargetWorkingValue    float64             `json:"target_working_value,omitempty"`
	TargetWorkingUnit     string              `json:"target_working_unit,omitempty"`
	CalculatedDeadline    time.Time           `json:"calculated_deadline"`
	RemainingWorkingHours float64             `json:"remaining_working_hours"`
	RemainingWorkingDays  float64             `json:"remaining_working_days"` // remaining hours / working day length
	WorkingDayHours       float64             `json:"working_day_hours"`
	CalendarDaysSpanned   int                 `json:"calendar_days_spanned"`
	SkippedDates          []SkippedDateInfo   `json:"skipped_dates,omitempty"`
	IsThresholdReached    bool                `json:"is_threshold_reached"`
	CalendarName          string              `json:"calendar_name"`
	WorkingIntervals      []WorkingInterval   `json:"working_intervals,omitempty"`
	NextAction            *NextActionableTask `json:"next_action,omitempty"`
	Stakeholders          []TenderStakeholder `json:"stakeholders,omitempty"`
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
	SchedulerIntervalValue *int     `json:"scheduler_interval_value"` // minutes
}

var hmPattern = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

// ValidateTrigger checks a deadline trigger and returns the normalised unit.
func ValidateTrigger(value float64, unit string) (string, error) {
	u := strings.ToUpper(strings.TrimSpace(unit))
	if u == "" {
		u = TriggerUnitHours
	}
	if u != TriggerUnitHours && u != TriggerUnitDays {
		return "", fmt.Errorf("trigger unit must be HOURS or DAYS")
	}
	if value <= 0 || TriggerDays(value, u) > MaxTriggerDays {
		return "", fmt.Errorf("trigger value must be greater than 0 and at most %d working days", MaxTriggerDays)
	}
	return u, nil
}

// TriggerDays converts a trigger value to working days.
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
	if r.SchedulerIntervalValue != nil && (*r.SchedulerIntervalValue < 1 || *r.SchedulerIntervalValue > 1440) {
		return fmt.Errorf("scheduler interval must be between 1 and 1440 minutes")
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
