package domain

import (
	"time"
)

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

// Notification Types
const (
	NotificationType72HourReminder = "72_HOUR_REMINDER"
	NotificationTypeRedZoneDueDate = "RED_ZONE_72H"
	NotificationTypeTaskDelay      = "TASK_DELAY"
	NotificationTypeEscalation     = "ESCALATION"
	NotificationTypeEMDAlert       = "EMD_ALERT"
)

// Task Statuses
const (
	TaskStatusPending    = "PENDING"
	TaskStatusInProgress = "IN_PROGRESS"
	TaskStatusCompleted  = "COMPLETED"
	TaskStatusDelayed    = "DELAYED"
	TaskStatusCancelled  = "CANCELLED"
)

type WorkingCalendar struct {
	ID                   string    `json:"id"`
	Name                 string    `json:"name"`
	Description          *string   `json:"description,omitempty"`
	IsDefault            bool      `json:"is_default"`
	Timezone             string    `json:"timezone"`
	WorkingStartTime     string    `json:"working_start_time"` // "09:00"
	WorkingEndTime       string    `json:"working_end_time"`   // "18:00"
	Saturday1Working     bool      `json:"saturday_1_working"`
	Saturday2Working     bool      `json:"saturday_2_working"` // Default: false (holiday)
	Saturday3Working     bool      `json:"saturday_3_working"`
	Saturday4Working     bool      `json:"saturday_4_working"` // Default: false (holiday)
	Saturday5Working     bool      `json:"saturday_5_working"`
	SundayWorking        bool      `json:"sunday_working"`     // Default: false
	MondayWorking        bool      `json:"monday_working"`
	TuesdayWorking       bool      `json:"tuesday_working"`
	WednesdayWorking     bool      `json:"wednesday_working"`
	ThursdayWorking      bool      `json:"thursday_working"`
	FridayWorking        bool      `json:"friday_working"`
	EscalationDelayHours int       `json:"escalation_delay_hours"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
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
	APIKey             *string    `json:"api_key,omitempty"`
	SyncEnabled        bool       `json:"sync_enabled"`
	SyncIntervalHours  int        `json:"sync_interval_hours"`
	LastSyncAt         *time.Time `json:"last_sync_at,omitempty"`
	SyncStatus         string     `json:"sync_status"`
	LastError          *string    `json:"last_error,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type GoogleCalendarSyncLog struct {
	ID             string    `json:"id"`
	IntegrationID  string    `json:"integration_id"`
	Status         string    `json:"status"` // SUCCESS, FAILED
	ImportedCount  int       `json:"imported_count"`
	UpdatedCount   int       `json:"updated_count"`
	SkippedCount   int       `json:"skipped_count"`
	FailedCount    int       `json:"failed_count"`
	ErrorDetails   *string   `json:"error_details,omitempty"`
	SyncedBy       *string   `json:"synced_by,omitempty"`
	SyncedByName   *string   `json:"synced_by_name,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type TaskNotification struct {
	ID              string     `json:"id"`
	TenderID        string     `json:"tender_id"`
	ChecklistID     *string    `json:"checklist_id,omitempty"`
	RecipientUserID string     `json:"recipient_user_id"`
	RecipientName   *string    `json:"recipient_name,omitempty"`
	RecipientEmail  *string    `json:"recipient_email,omitempty"`
	RecipientRole   *string    `json:"recipient_role,omitempty"`
	NotificationType string    `json:"notification_type"`
	ScheduledAt     time.Time  `json:"scheduled_at"`
	TriggeredAt     time.Time  `json:"triggered_at"`
	SentAt          *time.Time `json:"sent_at,omitempty"`
	DeliveryStatus  string     `json:"delivery_status"`
	Subject         string     `json:"subject"`
	Message         string     `json:"message"`
	ErrorMessage    *string    `json:"error_message,omitempty"`
	RetryCount      int        `json:"retry_count"`
	CreatedAt       time.Time  `json:"created_at"`
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
	DeliveryStatus        string              `json:"delivery_status"`
	TriggeredAt           time.Time           `json:"triggered_at"`
	Message               string              `json:"message"`
}

type TaskEscalation struct {
	ID               string    `json:"id"`
	TenderID         string    `json:"tender_id"`
	ChecklistID      *string   `json:"checklist_id,omitempty"`
	ManagerUserID    string    `json:"manager_user_id"`
	ManagerName      *string   `json:"manager_name,omitempty"`
	ManagerEmail     *string   `json:"manager_email,omitempty"`
	EscalationReason string    `json:"escalation_reason"`
	EscalatedAt      time.Time `json:"escalated_at"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
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
	TargetWorkingHours    float64             `json:"target_working_hours"`
	TargetWorkingDays     int                 `json:"target_working_days"`
	CalculatedDeadline    time.Time           `json:"calculated_deadline"`
	RemainingWorkingHours float64             `json:"remaining_working_hours"`
	RemainingWorkingDays  float64             `json:"remaining_working_days"`
	CalendarDaysSpanned   int                 `json:"calendar_days_spanned"`
	SkippedDates          []SkippedDateInfo   `json:"skipped_dates,omitempty"`
	IsThresholdReached    bool                `json:"is_threshold_reached"`
	CalendarName          string              `json:"calendar_name"`
	WorkingIntervals      []WorkingInterval   `json:"working_intervals,omitempty"`
	NextAction            *NextActionableTask `json:"next_action,omitempty"`
	Stakeholders          []TenderStakeholder `json:"stakeholders,omitempty"`
}

type NextActionableTask struct {
	ChecklistID   string     `json:"checklist_id"`
	Title         string     `json:"title"`
	Priority      string     `json:"priority"` // HIGH, MEDIUM, LOW
	AssignedToID   *string    `json:"assigned_to_id,omitempty"`
	AssignedToName *string    `json:"assigned_to_name,omitempty"`
	AssignedRole   *string    `json:"assigned_role,omitempty"`
	SortOrder     int        `json:"sort_order"`
	DueAt         *time.Time `json:"due_at,omitempty"`
	Status        string     `json:"status"`
}

// DTO Requests
type UpdateCalendarRequest struct {
	Name                 string  `json:"name"`
	Description          *string `json:"description,omitempty"`
	WorkingStartTime     string  `json:"working_start_time"`
	WorkingEndTime       string  `json:"working_end_time"`
	Saturday1Working     bool    `json:"saturday_1_working"`
	Saturday2Working     bool    `json:"saturday_2_working"`
	Saturday3Working     bool    `json:"saturday_3_working"`
	Saturday4Working     bool    `json:"saturday_4_working"`
	Saturday5Working     bool    `json:"saturday_5_working"`
	SundayWorking        bool    `json:"sunday_working"`
	MondayWorking        bool    `json:"monday_working"`
	TuesdayWorking       bool    `json:"tuesday_working"`
	WednesdayWorking     bool    `json:"wednesday_working"`
	ThursdayWorking      bool    `json:"thursday_working"`
	FridayWorking        bool    `json:"friday_working"`
	EscalationDelayHours int     `json:"escalation_delay_hours"`
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
	HolidayName   *string `json:"holiday_name,omitempty"`
	HolidayType   *string `json:"holiday_type,omitempty"`
	WorkingStatus *string `json:"working_status,omitempty"`
	Priority      *string `json:"priority,omitempty"`
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
	APIKey             *string `json:"api_key,omitempty"`
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
	Status       *string `json:"status,omitempty"`
}
