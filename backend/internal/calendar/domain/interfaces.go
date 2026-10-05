package domain

import (
	"context"
	"time"
)

type WorkingCalendarRepository interface {
	// Calendars
	GetDefaultCalendar(ctx context.Context) (*WorkingCalendar, error)
	GetCalendarByID(ctx context.Context, id string) (*WorkingCalendar, error)
	ListCalendars(ctx context.Context) ([]WorkingCalendar, error)
	UpdateCalendar(ctx context.Context, id string, req *UpdateCalendarRequest) (*WorkingCalendar, error)

	// Holidays
	ListHolidays(ctx context.Context, calendarID string, year int) ([]Holiday, error)
	GetHolidayByID(ctx context.Context, id string) (*Holiday, error)
	GetHolidayByDate(ctx context.Context, calendarID string, date string) (*Holiday, error)
	CreateHoliday(ctx context.Context, holiday *Holiday) (*Holiday, error)
	UpdateHoliday(ctx context.Context, id string, req *UpdateHolidayRequest, updatedBy string) (*Holiday, error)
	DeleteHoliday(ctx context.Context, id string) error
	UpsertGoogleHolidays(ctx context.Context, calendarID string, holidays []Holiday) (*SyncResult, error)

	// Exceptions
	ListExceptions(ctx context.Context, calendarID string) ([]CalendarException, error)
	GetExceptionByDate(ctx context.Context, calendarID string, date string) (*CalendarException, error)
	CreateException(ctx context.Context, exc *CalendarException) (*CalendarException, error)
	DeleteException(ctx context.Context, id string) error

	// Google Integration
	GetGoogleIntegration(ctx context.Context, calendarID string) (*GoogleCalendarIntegration, error)
	SaveGoogleIntegration(ctx context.Context, integration *GoogleCalendarIntegration) (*GoogleCalendarIntegration, error)
	CreateSyncLog(ctx context.Context, log *GoogleCalendarSyncLog) error
	ListSyncLogs(ctx context.Context, integrationID string, limit int) ([]GoogleCalendarSyncLog, error)

	// Notifications & Escalations
	HasNotificationBeenSent(ctx context.Context, tenderID string, checklistID *string, notifType string) (bool, error)
	HasRedZoneNotificationBeenSent(ctx context.Context, tenderID string, deadline time.Time) (bool, error)
	RecordNotification(ctx context.Context, notif *TaskNotification) error
	ListNotificationsByTender(ctx context.Context, tenderID string) ([]TaskNotification, error)
	HasEscalationBeenSent(ctx context.Context, tenderID string, checklistID *string) (bool, error)
	RecordEscalation(ctx context.Context, esc *TaskEscalation) error
	ListEscalationsByTender(ctx context.Context, tenderID string) ([]TaskEscalation, error)

	// Tender Checklist enhancements & Stakeholders
	GetTenderStakeholders(ctx context.Context, tenderID string) ([]TenderStakeholder, error)
	GetNextPendingChecklist(ctx context.Context, tenderID string) (*NextActionableTask, error)
	UpdateChecklistPriorityAndAssignment(ctx context.Context, checklistID string, req *UpdateChecklistPriorityRequest) error
	MarkChecklistDelayed(ctx context.Context, checklistID string) error
	UpdateTenderDeadlineCache(ctx context.Context, tenderID string, deadline time.Time, remainingHours float64) error
	GetActiveTendersForDeadlineCheck(ctx context.Context) ([]TenderDeadlineCandidate, error)
}

type TenderDeadlineCandidate struct {
	ID                 string     `json:"id"`
	Title              string     `json:"title"`
	BidNo              *string    `json:"bid_no,omitempty"`
	GemBidNo           *string    `json:"gem_bid_no,omitempty"`
	WorkflowStage      string     `json:"workflow_stage"`
	ClosingDate        time.Time  `json:"closing_date"`
	CalendarID         *string    `json:"calendar_id,omitempty"`
	BidOwnerID         string     `json:"bid_owner_id"`
	ReportingManagerID *string    `json:"reporting_manager_id,omitempty"`
	AccountManagerID   *string    `json:"account_manager_id,omitempty"`
	PresalesID         *string    `json:"presales_id,omitempty"`
	BidOwnerEmail      *string    `json:"bid_owner_email,omitempty"`
	BidOwnerName       *string    `json:"bid_owner_name,omitempty"`
	ManagerEmail       *string    `json:"manager_email,omitempty"`
	ManagerName        *string    `json:"manager_name,omitempty"`
	OrganizationName   *string    `json:"organization_name,omitempty"`
	DepartmentName     *string    `json:"department_name,omitempty"`
	EstimatedValue     *float64   `json:"estimated_value,omitempty"`
}

type WorkingCalendarService interface {
	// Calendar methods as required by specification Section 13
	IsWorkingDay(ctx context.Context, calendarID string, date time.Time) (bool, string, error)
	IsHoliday(ctx context.Context, calendarID string, date time.Time) (bool, *Holiday, error)
	IsSaturdayHoliday(calendar *WorkingCalendar, date time.Time) bool
	IsSpecialWorkingDay(ctx context.Context, calendarID string, date time.Time) (bool, error)
	IsSpecialNonWorkingDay(ctx context.Context, calendarID string, date time.Time) (bool, error)
	GetSaturdayNumber(date time.Time) int
	GetWorkingIntervals(calendar *WorkingCalendar, date time.Time) []WorkingInterval

	// Working hour and working day mathematical computations
	AddWorkingHours(ctx context.Context, calendarID string, fromTime time.Time, hours float64) (time.Time, error)
	SubtractWorkingHours(ctx context.Context, calendarID string, fromTime time.Time, hours float64) (time.Time, error)
	CalculateRemainingWorkingHours(ctx context.Context, calendarID string, fromTime, toTime time.Time) (float64, error)
	AddWorkingDays(ctx context.Context, calendarID string, fromTime time.Time, days int) (time.Time, error)
	SubtractWorkingDays(ctx context.Context, calendarID string, fromTime time.Time, days int) (time.Time, error)
	CalculateRemainingWorkingDays(ctx context.Context, calendarID string, fromTime, toTime time.Time) (float64, error)
	CalculateTender72HourDeadline(ctx context.Context, tenderID string) (*CalculateDeadlineResult, error)
	CalculateArbitraryDeadline(ctx context.Context, calendarID string, closingDate time.Time, targetHours float64) (*CalculateDeadlineResult, error)
	GetNextActionableTask(ctx context.Context, tenderID string) (*NextActionableTask, error)
	GetTenderStakeholders(ctx context.Context, tenderID string) ([]TenderStakeholder, error)

	// Red Zone & Background worker evaluation
	EvaluateActiveTenders(ctx context.Context) error
	TriggerRedZoneNotificationForTender(ctx context.Context, tenderID string, force bool) (*RedZoneNotificationResult, error)
}

type GoogleSyncService interface {
	SyncHolidays(ctx context.Context, calendarID string, actorID *string) (*SyncResult, error)
}
