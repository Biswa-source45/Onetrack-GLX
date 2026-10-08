package handler

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/onetrack/backend/internal/calendar/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

type CalendarHandler struct {
	repo    domain.WorkingCalendarRepository
	calSvc  domain.WorkingCalendarService
	syncSvc domain.GoogleSyncService
	// engineEnabled mirrors CALENDAR_SCHEDULER_ENABLED: while off, only admins can send alerts by hand.
	engineEnabled bool
}

func NewCalendarHandler(
	repo domain.WorkingCalendarRepository,
	calSvc domain.WorkingCalendarService,
	syncSvc domain.GoogleSyncService,
	engineEnabled bool,
) *CalendarHandler {
	return &CalendarHandler{repo: repo, calSvc: calSvc, syncSvc: syncSvc, engineEnabled: engineEnabled}
}

// fail logs the real error and answers with a generic message; known
// conditions get their proper status instead of a blanket 500.
func fail(c *gin.Context, err error, msg string) {
	log.Printf("[Calendar] %s: %v", msg, err)
	var pgErr *pgconn.PgError
	switch {
	case errors.Is(err, domain.ErrTenderNotFound):
		response.NotFound(c, "Tender not found or not eligible for deadline tracking")
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		response.Conflict(c, "A matching entry already exists")
	default:
		response.InternalError(c, msg)
	}
}

func isAdmin(c *gin.Context) bool {
	roles, _ := c.Get("roles")
	list, _ := roles.([]string)
	for _, r := range list {
		if r == "SUPER_ADMIN" || r == "ADMIN" {
			return true
		}
	}
	return false
}

func actorPtr(c *gin.Context) *string {
	if id := c.GetString("user_id"); id != "" {
		return &id
	}
	return nil
}

func oneOf(v string, allowed ...string) bool {
	for _, a := range allowed {
		if v == a {
			return true
		}
	}
	return false
}

// maskIntegration strips the stored key from a response, leaving only whether
// one is set and its last 4 characters.
func maskIntegration(g *domain.GoogleCalendarIntegration) *domain.GoogleCalendarIntegration {
	out := *g
	out.APIKey = nil
	if g.APIKey != nil && *g.APIKey != "" {
		out.APIKeySet = true
		if k := *g.APIKey; len(k) > 4 {
			out.APIKeyHint = k[len(k)-4:]
		}
	}
	return &out
}

// isRealAPIKey rejects empty values and masked placeholders ("••••", "AIza...F1A"):
// a Google API key only contains letters, digits, '-' and '_'.
func isRealAPIKey(k string) bool {
	if k == "" {
		return false
	}
	for _, r := range k {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

// ── Calendars ────────────────────────────────────────────────────────────────

func (h *CalendarHandler) GetDefaultCalendar(c *gin.Context) {
	cal, err := h.repo.GetDefaultCalendar(c.Request.Context())
	if err != nil {
		fail(c, err, "Failed to retrieve default calendar")
		return
	}
	if cal == nil {
		response.NotFound(c, "Default working calendar not found")
		return
	}
	response.Success(c, http.StatusOK, "Default calendar retrieved", cal)
}

func (h *CalendarHandler) UpdateCalendar(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	var req domain.UpdateCalendarRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid calendar parameters", nil)
		return
	}
	cur, err := h.repo.GetCalendarByID(ctx, id)
	if err != nil {
		fail(c, err, "Failed to retrieve working calendar")
		return
	}
	if cur == nil {
		response.NotFound(c, "Working calendar not found")
		return
	}
	if err := req.Validate(cur); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	updated, err := h.repo.UpdateCalendar(ctx, id, &req)
	if err != nil {
		fail(c, err, "Failed to update working calendar")
		return
	}
	response.Success(c, http.StatusOK, "Working calendar updated successfully", updated)
}

// ── Holidays ─────────────────────────────────────────────────────────────────

func (h *CalendarHandler) ListHolidays(c *gin.Context) {
	year, _ := strconv.Atoi(c.Query("year"))
	holidays, err := h.repo.ListHolidays(c.Request.Context(), c.Param("id"), year)
	if err != nil {
		fail(c, err, "Failed to list holidays")
		return
	}
	response.Success(c, http.StatusOK, "Holidays retrieved successfully", holidays)
}

func (h *CalendarHandler) CreateHoliday(c *gin.Context) {
	var req domain.CreateHolidayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid holiday data", nil)
		return
	}
	if _, err := time.Parse("2006-01-02", req.HolidayDate); err != nil {
		response.BadRequest(c, "holiday_date must be YYYY-MM-DD", nil)
		return
	}
	if req.HolidayType == "" {
		req.HolidayType = domain.HolidayTypeCompany
	}
	if req.WorkingStatus == "" {
		req.WorkingStatus = domain.WorkingStatusNonWorking
	}
	if req.Priority == "" {
		req.Priority = domain.PriorityHigh
	}
	if !oneOf(req.HolidayType, domain.HolidayTypeGovernment, domain.HolidayTypeCompany, domain.HolidayTypeRegional, domain.HolidayTypeOptional, domain.HolidayTypeSpecial) ||
		!oneOf(req.WorkingStatus, domain.WorkingStatusNonWorking, domain.WorkingStatusWorking, domain.WorkingStatusOptional) ||
		!oneOf(req.Priority, domain.PriorityHigh, domain.PriorityMedium, domain.PriorityLow) {
		response.BadRequest(c, "Invalid holiday type, working status or priority", nil)
		return
	}

	created, err := h.repo.CreateHoliday(c.Request.Context(), &domain.Holiday{
		CalendarID:      c.Param("id"),
		HolidayDate:     req.HolidayDate,
		HolidayName:     strings.TrimSpace(req.HolidayName),
		HolidayType:     req.HolidayType,
		WorkingStatus:   req.WorkingStatus,
		Priority:        req.Priority,
		Source:          domain.SourceAdmin,
		IsAdminOverride: true,
		IsActive:        true,
		Description:     req.Description,
		CreatedBy:       actorPtr(c),
	})
	if err != nil {
		fail(c, err, "Failed to create holiday")
		return
	}
	response.Success(c, http.StatusCreated, "Holiday created successfully", created)
}

func (h *CalendarHandler) UpdateHoliday(c *gin.Context) {
	var req domain.UpdateHolidayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid update parameters", nil)
		return
	}
	if (req.HolidayType != nil && !oneOf(*req.HolidayType, domain.HolidayTypeGovernment, domain.HolidayTypeCompany, domain.HolidayTypeRegional, domain.HolidayTypeOptional, domain.HolidayTypeSpecial)) ||
		(req.WorkingStatus != nil && !oneOf(*req.WorkingStatus, domain.WorkingStatusNonWorking, domain.WorkingStatusWorking, domain.WorkingStatusOptional)) ||
		(req.Priority != nil && !oneOf(*req.Priority, domain.PriorityHigh, domain.PriorityMedium, domain.PriorityLow)) {
		response.BadRequest(c, "Invalid holiday type, working status or priority", nil)
		return
	}

	updated, err := h.repo.UpdateHoliday(c.Request.Context(), c.Param("holidayId"), &req, c.GetString("user_id"))
	if err != nil {
		fail(c, err, "Failed to update holiday")
		return
	}
	response.Success(c, http.StatusOK, "Holiday updated successfully", updated)
}

func (h *CalendarHandler) DeleteHoliday(c *gin.Context) {
	if err := h.repo.DeleteHoliday(c.Request.Context(), c.Param("holidayId")); err != nil {
		fail(c, err, "Failed to delete holiday")
		return
	}
	response.Success(c, http.StatusOK, "Holiday deleted successfully", gin.H{"deleted": true})
}

// ── Special Exceptions ───────────────────────────────────────────────────────

func (h *CalendarHandler) ListExceptions(c *gin.Context) {
	exceptions, err := h.repo.ListExceptions(c.Request.Context(), c.Param("id"))
	if err != nil {
		fail(c, err, "Failed to retrieve exceptions")
		return
	}
	response.Success(c, http.StatusOK, "Calendar exceptions retrieved", exceptions)
}

func (h *CalendarHandler) CreateException(c *gin.Context) {
	var req domain.CreateExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid exception payload", nil)
		return
	}
	if _, err := time.Parse("2006-01-02", req.ExceptionDate); err != nil {
		response.BadRequest(c, "exception_date must be YYYY-MM-DD", nil)
		return
	}
	if !oneOf(req.ExceptionType, domain.ExceptionSpecialWorkingDay, domain.ExceptionSpecialNonWorkingDay) {
		response.BadRequest(c, "Invalid exception type", nil)
		return
	}

	created, err := h.repo.CreateException(c.Request.Context(), &domain.CalendarException{
		CalendarID:    c.Param("id"),
		ExceptionDate: req.ExceptionDate,
		ExceptionType: req.ExceptionType,
		Reason:        req.Reason,
		CreatedBy:     actorPtr(c),
	})
	if err != nil {
		fail(c, err, "Failed to save exception")
		return
	}
	response.Success(c, http.StatusCreated, "Special exception recorded", created)
}

func (h *CalendarHandler) DeleteException(c *gin.Context) {
	if err := h.repo.DeleteException(c.Request.Context(), c.Param("exceptionId")); err != nil {
		fail(c, err, "Failed to delete exception")
		return
	}
	response.Success(c, http.StatusOK, "Special exception removed", gin.H{"deleted": true})
}

// ── Google Calendar Sync ─────────────────────────────────────────────────────

func (h *CalendarHandler) GetGoogleIntegration(c *gin.Context) {
	calendarID := c.Param("id")
	integration, err := h.repo.GetGoogleIntegration(c.Request.Context(), calendarID)
	if err != nil {
		fail(c, err, "Failed to retrieve Google Calendar configuration")
		return
	}
	if integration == nil {
		integration = domain.DefaultIntegration(calendarID)
	}
	response.Success(c, http.StatusOK, "Google Calendar integration status retrieved", maskIntegration(integration))
}

func (h *CalendarHandler) ConfigureGoogleIntegration(c *gin.Context) {
	var req domain.ConfigureGoogleSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid Google Calendar configuration", nil)
		return
	}

	// An empty or masked key keeps the stored one (the save query COALESCEs a nil key).
	var apiKey *string
	if req.APIKey != nil {
		if k := strings.TrimSpace(*req.APIKey); isRealAPIKey(k) {
			apiKey = &k
		}
	}

	cfg := &domain.GoogleCalendarIntegration{
		CalendarID:         c.Param("id"),
		GoogleCalendarID:   req.GoogleCalendarID,
		GoogleCalendarName: req.GoogleCalendarName,
		APIKey:             apiKey,
		SyncEnabled:        req.SyncEnabled,
		SyncIntervalHours:  req.SyncIntervalHours,
		SyncStatus:         "IDLE",
	}
	// Editing the configuration must not erase the outcome of the last sync.
	if prev, err := h.repo.GetGoogleIntegration(c.Request.Context(), cfg.CalendarID); err == nil && prev != nil {
		cfg.SyncStatus, cfg.LastSyncAt, cfg.LastError = prev.SyncStatus, prev.LastSyncAt, prev.LastError
	}
	saved, err := h.repo.SaveGoogleIntegration(c.Request.Context(), cfg)
	if err != nil {
		fail(c, err, "Failed to save Google Calendar configuration")
		return
	}
	response.Success(c, http.StatusOK, "Google Calendar configuration updated", maskIntegration(saved))
}

func (h *CalendarHandler) TriggerGoogleSync(c *gin.Context) {
	res, err := h.syncSvc.SyncHolidays(c.Request.Context(), c.Param("id"), actorPtr(c))
	if err != nil {
		fail(c, err, "Synchronization error")
		return
	}
	response.Success(c, http.StatusOK, "Google synchronization finished", res)
}

func (h *CalendarHandler) ListSyncLogs(c *gin.Context) {
	integration, err := h.repo.GetGoogleIntegration(c.Request.Context(), c.Param("id"))
	if err != nil || integration == nil {
		response.Success(c, http.StatusOK, "Sync history empty", []domain.GoogleCalendarSyncLog{})
		return
	}

	limit := 20
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 200 {
		limit = l
	}
	logs, err := h.repo.ListSyncLogs(c.Request.Context(), integration.ID, limit)
	if err != nil {
		fail(c, err, "Failed to retrieve sync history")
		return
	}
	response.Success(c, http.StatusOK, "Sync logs retrieved", logs)
}

// ── Deadline Calculations ────────────────────────────────────────────────────

func (h *CalendarHandler) GetTenderWorkingDeadline(c *gin.Context) {
	res, err := h.calSvc.CalculateTender72HourDeadline(c.Request.Context(), c.Param("id"))
	if err != nil {
		fail(c, err, "Failed to compute tender deadline")
		return
	}
	response.Success(c, http.StatusOK, "Tender working deadline calculated", res)
}

func (h *CalendarHandler) UpdateChecklistPriority(c *gin.Context) {
	var req domain.UpdateChecklistPriorityRequest
	if err := c.ShouldBindJSON(&req); err != nil || !oneOf(req.Priority, domain.PriorityHigh, domain.PriorityMedium, domain.PriorityLow) {
		response.BadRequest(c, "Invalid checklist priority data", nil)
		return
	}
	if err := h.repo.UpdateChecklistPriorityAndAssignment(c.Request.Context(), c.Param("cid"), &req); err != nil {
		fail(c, err, "Failed to update checklist item")
		return
	}
	response.Success(c, http.StatusOK, "Checklist priority updated successfully", gin.H{"updated": true})
}

func (h *CalendarHandler) EvaluateDeadlines(c *gin.Context) {
	sum, err := h.calSvc.EvaluateActiveTenders(c.Request.Context())
	if err != nil {
		fail(c, err, "Failed to evaluate tender deadlines")
		return
	}
	response.Success(c, http.StatusOK, "Deadline evaluation completed", sum)
}

func (h *CalendarHandler) TriggerTenderRedZoneNotification(c *gin.Context) {
	force := c.Query("force") == "true"
	if force && !isAdmin(c) {
		response.Forbidden(c, "Only administrators can re-send a Red Zone notification")
		return
	}
	if !h.engineEnabled && !isAdmin(c) {
		response.Success(c, http.StatusOK, "Deadline engine is disabled", gin.H{"delivery_status": "ENGINE_DISABLED", "message": "The deadline alert engine is not enabled on this server"})
		return
	}
	res, err := h.calSvc.TriggerRedZoneNotificationForTender(c.Request.Context(), c.Param("id"), force)
	if err != nil {
		fail(c, err, "Failed to trigger Red Zone notification")
		return
	}
	response.Success(c, http.StatusOK, "Red Zone notification processed", res)
}
