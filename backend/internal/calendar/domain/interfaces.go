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

	// Holidays. ListHolidays is ordered so the first row per date is the one that
	// applies: admin-created first, then HIGH priority, then id.
	ListHolidays(ctx context.Context, calendarID string, year int) ([]Holiday, error)
	GetHolidayByID(ctx context.Context, id string) (*Holiday, error)
	CreateHoliday(ctx context.Context, holiday *Holiday) (*Holiday, error)
	UpdateHoliday(ctx context.Context, id string, req *UpdateHolidayRequest, updatedBy string) (*Holiday, error)
	DeleteHoliday(ctx context.Context, id string) error
	UpsertGoogleHolidays(ctx context.Context, calendarID string, holidays []Holiday) (*SyncResult, error)

	// Exceptions
	ListExceptions(ctx context.Context, calendarID string) ([]CalendarException, error)
	CreateException(ctx context.Context, exc *CalendarException) (*CalendarException, error)
	DeleteException(ctx context.Context, id string) error

	// Google Integration
	GetGoogleIntegration(ctx context.Context, calendarID string) (*GoogleCalendarIntegration, error)
	SaveGoogleIntegration(ctx context.Context, integration *GoogleCalendarIntegration) (*GoogleCalendarIntegration, error)
	CreateSyncLog(ctx context.Context, log *GoogleCalendarSyncLog) error
	ListSyncLogs(ctx context.Context, integrationID string, limit int) ([]GoogleCalendarSyncLog, error)

	// Notifications. ClaimNotification inserts the dedup row before anything is
	// sent and returns its id, or "" when a row for the same deadline already
	// exists (force overrides). ReleaseNotification drops a claimed row whose alert
	// could not be created, so the next run retries it.
	HasRedZoneNotificationBeenSent(ctx context.Context, tenderID string, deadline time.Time) (bool, error)
	ClaimNotification(ctx context.Context, notif *TaskNotification, force bool) (string, error)
	ReleaseNotification(ctx context.Context, id string) error

	// One-time engine baseline marker, and a cross-instance evaluation lock.
	IsEngineBaselined(ctx context.Context) (bool, error)
	MarkEngineBaselined(ctx context.Context) error
	TryLockEvaluation(ctx context.Context) (release func(), ok bool, err error)

	// Tender checklist & stakeholders
	GetTenderStakeholders(ctx context.Context, tenderID string) ([]TenderStakeholder, error)
	GetNextPendingChecklist(ctx context.Context, tenderID string) (*NextActionableTask, error)
	UpdateChecklistPriorityAndAssignment(ctx context.Context, checklistID string, req *UpdateChecklistPriorityRequest) error
	UpdateTenderDeadlineCache(ctx context.Context, tenderID string, deadline time.Time, remainingHours float64) error

	// GetActiveTendersForDeadlineCheck returns open, unsubmitted tenders closing in (from, to].
	GetActiveTendersForDeadlineCheck(ctx context.Context, from, to time.Time) ([]TenderDeadlineCandidate, error)
	// GetTenderCandidate applies the same eligibility rules without the time window; nil when ineligible.
	GetTenderCandidate(ctx context.Context, tenderID string) (*TenderDeadlineCandidate, error)
}

type TenderDeadlineCandidate struct {
	ID               string
	Title            string
	BidNo            *string
	GemBidNo         *string
	WorkflowStage    string
	ClosingDate      time.Time
	CalendarID       *string
	OrganizationName *string
	DepartmentName   *string
	// Values currently cached on the tender row, so unchanged results are not rewritten.
	CachedDeadline       *time.Time
	CachedRemainingHours *float64
}

type WorkingCalendarService interface {
	CalculateTender72HourDeadline(ctx context.Context, tenderID string) (*CalculateDeadlineResult, error)

	// EvaluateActiveTenders runs one engine pass (see EvaluationSummary).
	EvaluateActiveTenders(ctx context.Context) (*EvaluationSummary, error)
	TriggerRedZoneNotificationForTender(ctx context.Context, tenderID string, force bool) (*RedZoneNotificationResult, error)
}

type GoogleSyncService interface {
	SyncHolidays(ctx context.Context, calendarID string, actorID *string) (*SyncResult, error)
}
