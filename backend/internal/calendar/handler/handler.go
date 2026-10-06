package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/calendar/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

type SchedulerTrigger interface {
	TriggerReset()
}

type CalendarHandler struct {
	repo      domain.WorkingCalendarRepository
	calSvc    domain.WorkingCalendarService
	syncSvc   domain.GoogleSyncService
	scheduler SchedulerTrigger
}

func NewCalendarHandler(
	repo domain.WorkingCalendarRepository,
	calSvc domain.WorkingCalendarService,
	syncSvc domain.GoogleSyncService,
) *CalendarHandler {
	return &CalendarHandler{
		repo:    repo,
		calSvc:  calSvc,
		syncSvc: syncSvc,
	}
}

func (h *CalendarHandler) SetScheduler(s SchedulerTrigger) {
	h.scheduler = s
}

// ── Calendars ────────────────────────────────────────────────────────────────

func (h *CalendarHandler) ListCalendars(c *gin.Context) {
	calendars, err := h.repo.ListCalendars(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to retrieve working calendars")
		return
	}
	response.Success(c, http.StatusOK, "Working calendars retrieved", calendars)
}

func (h *CalendarHandler) GetDefaultCalendar(c *gin.Context) {
	cal, err := h.repo.GetDefaultCalendar(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to retrieve default calendar")
		return
	}
	if cal == nil {
		response.NotFound(c, "Default working calendar not found")
		return
	}
	response.Success(c, http.StatusOK, "Default calendar retrieved", cal)
}

func (h *CalendarHandler) GetCalendarByID(c *gin.Context) {
	id := c.Param("id")
	cal, err := h.repo.GetCalendarByID(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, "Failed to retrieve working calendar")
		return
	}
	if cal == nil {
		response.NotFound(c, "Working calendar not found")
		return
	}
	response.Success(c, http.StatusOK, "Working calendar retrieved", cal)
}

func (h *CalendarHandler) UpdateCalendar(c *gin.Context) {
	id := c.Param("id")
	var req domain.UpdateCalendarRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid calendar parameters", nil)
		return
	}

	updated, err := h.repo.UpdateCalendar(c.Request.Context(), id, &req)
	if err != nil {
		response.InternalError(c, "Failed to update working calendar")
		return
	}
	if h.scheduler != nil {
		h.scheduler.TriggerReset()
	}
	response.Success(c, http.StatusOK, "Working calendar updated successfully", updated)
}

// ── Holidays ─────────────────────────────────────────────────────────────────

func (h *CalendarHandler) ListHolidays(c *gin.Context) {
	calendarID := c.Param("id")
	yearStr := c.Query("year")
	year := 0
	if yearStr != "" {
		year, _ = strconv.Atoi(yearStr)
	}

	holidays, err := h.repo.ListHolidays(c.Request.Context(), calendarID, year)
	if err != nil {
		response.InternalError(c, "Failed to list holidays")
		return
	}
	response.Success(c, http.StatusOK, "Holidays retrieved successfully", holidays)
}

func (h *CalendarHandler) CreateHoliday(c *gin.Context) {
	calendarID := c.Param("id")
	var req domain.CreateHolidayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid holiday data", nil)
		return
	}

	actorID := c.GetString("user_id")
	var actorIDPtr *string
	if actorID != "" {
		actorIDPtr = &actorID
	}

	workingStatus := req.WorkingStatus
	if workingStatus == "" {
		workingStatus = domain.WorkingStatusNonWorking
	}
	priority := req.Priority
	if priority == "" {
		priority = domain.PriorityHigh
	}
	hType := req.HolidayType
	if hType == "" {
		hType = domain.HolidayTypeCompany
	}

	holiday := &domain.Holiday{
		CalendarID:      calendarID,
		HolidayDate:     req.HolidayDate,
		HolidayName:     req.HolidayName,
		HolidayType:     hType,
		WorkingStatus:   workingStatus,
		Priority:        priority,
		Source:          domain.SourceAdmin,
		IsAdminOverride: true,
		IsActive:        true,
		Description:     req.Description,
		CreatedBy:       actorIDPtr,
	}

	created, err := h.repo.CreateHoliday(c.Request.Context(), holiday)
	if err != nil {
		response.InternalError(c, "Failed to create holiday: "+err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Holiday created successfully", created)
}

func (h *CalendarHandler) UpdateHoliday(c *gin.Context) {
	holidayID := c.Param("holidayId")
	var req domain.UpdateHolidayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid update parameters", nil)
		return
	}

	actorID := c.GetString("user_id")
	updated, err := h.repo.UpdateHoliday(c.Request.Context(), holidayID, &req, actorID)
	if err != nil {
		response.InternalError(c, "Failed to update holiday: "+err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Holiday updated successfully", updated)
}

func (h *CalendarHandler) DeleteHoliday(c *gin.Context) {
	holidayID := c.Param("holidayId")
	if err := h.repo.DeleteHoliday(c.Request.Context(), holidayID); err != nil {
		response.InternalError(c, "Failed to delete holiday")
		return
	}
	response.Success(c, http.StatusOK, "Holiday deleted successfully", gin.H{"deleted": true})
}

// ── Special Exceptions ───────────────────────────────────────────────────────

func (h *CalendarHandler) ListExceptions(c *gin.Context) {
	calendarID := c.Param("id")
	exceptions, err := h.repo.ListExceptions(c.Request.Context(), calendarID)
	if err != nil {
		response.InternalError(c, "Failed to retrieve exceptions")
		return
	}
	response.Success(c, http.StatusOK, "Calendar exceptions retrieved", exceptions)
}

func (h *CalendarHandler) CreateException(c *gin.Context) {
	calendarID := c.Param("id")
	var req domain.CreateExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid exception payload", nil)
		return
	}

	actorID := c.GetString("user_id")
	var actorIDPtr *string
	if actorID != "" {
		actorIDPtr = &actorID
	}

	exc := &domain.CalendarException{
		CalendarID:    calendarID,
		ExceptionDate: req.ExceptionDate,
		ExceptionType: req.ExceptionType,
		Reason:        req.Reason,
		CreatedBy:     actorIDPtr,
	}

	created, err := h.repo.CreateException(c.Request.Context(), exc)
	if err != nil {
		response.InternalError(c, "Failed to save exception: "+err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Special exception recorded", created)
}

func (h *CalendarHandler) DeleteException(c *gin.Context) {
	exceptionID := c.Param("exceptionId")
	if err := h.repo.DeleteException(c.Request.Context(), exceptionID); err != nil {
		response.InternalError(c, "Failed to delete exception")
		return
	}
	response.Success(c, http.StatusOK, "Special exception removed", gin.H{"deleted": true})
}

// ── Google Calendar Sync ─────────────────────────────────────────────────────

func (h *CalendarHandler) GetGoogleIntegration(c *gin.Context) {
	calendarID := c.Param("id")
	integration, err := h.repo.GetGoogleIntegration(c.Request.Context(), calendarID)
	if err != nil {
		response.InternalError(c, "Failed to retrieve Google Calendar configuration")
		return
	}
	if integration == nil {
		integration = &domain.GoogleCalendarIntegration{
			CalendarID:         calendarID,
			GoogleCalendarID:   "en.indian#holiday@group.v.calendar.google.com",
			GoogleCalendarName: "Indian National Holidays",
			SyncEnabled:        true,
			SyncIntervalHours:  24,
			SyncStatus:         "IDLE",
		}
	}
	response.Success(c, http.StatusOK, "Google Calendar integration status retrieved", integration)
}

func (h *CalendarHandler) ConfigureGoogleIntegration(c *gin.Context) {
	calendarID := c.Param("id")
	var req domain.ConfigureGoogleSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid Google Calendar configuration", nil)
		return
	}

	integration := &domain.GoogleCalendarIntegration{
		CalendarID:         calendarID,
		GoogleCalendarID:   req.GoogleCalendarID,
		GoogleCalendarName: req.GoogleCalendarName,
		APIKey:             req.APIKey,
		SyncEnabled:        req.SyncEnabled,
		SyncIntervalHours:  req.SyncIntervalHours,
		SyncStatus:         "IDLE",
	}

	saved, err := h.repo.SaveGoogleIntegration(c.Request.Context(), integration)
	if err != nil {
		response.InternalError(c, "Failed to save Google Calendar configuration")
		return
	}
	response.Success(c, http.StatusOK, "Google Calendar configuration updated", saved)
}

func (h *CalendarHandler) TriggerGoogleSync(c *gin.Context) {
	calendarID := c.Param("id")
	actorID := c.GetString("user_id")
	var actorIDPtr *string
	if actorID != "" {
		actorIDPtr = &actorID
	}

	res, err := h.syncSvc.SyncHolidays(c.Request.Context(), calendarID, actorIDPtr)
	if err != nil {
		response.InternalError(c, "Synchronization error: "+err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Google synchronization finished", res)
}

func (h *CalendarHandler) ListSyncLogs(c *gin.Context) {
	calendarID := c.Param("id")
	integration, err := h.repo.GetGoogleIntegration(c.Request.Context(), calendarID)
	if err != nil || integration == nil {
		response.Success(c, http.StatusOK, "Sync history empty", []domain.GoogleCalendarSyncLog{})
		return
	}

	limit := 20
	if lStr := c.Query("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}

	logs, err := h.repo.ListSyncLogs(c.Request.Context(), integration.ID, limit)
	if err != nil {
		response.InternalError(c, "Failed to retrieve sync history")
		return
	}
	response.Success(c, http.StatusOK, "Sync logs retrieved", logs)
}

// ── Deadline Calculations ────────────────────────────────────────────────────

func (h *CalendarHandler) CalculateArbitraryDeadline(c *gin.Context) {
	calendarID := c.Param("id")
	type reqPayload struct {
		ClosingDate string   `json:"closing_date" binding:"required"`
		TargetHours float64  `json:"target_hours"`
		TargetValue *float64 `json:"target_value"`
		TargetUnit  *string  `json:"target_unit"`
	}
	var req reqPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid calculation input", nil)
		return
	}

	var closingTime time.Time
	var parseErr error

	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, f := range formats {
		closingTime, parseErr = time.Parse(f, req.ClosingDate)
		if parseErr == nil {
			break
		}
	}

	if parseErr != nil {
		response.BadRequest(c, "Invalid date format. Expected datetime format (e.g. YYYY-MM-DDTHH:mm or RFC3339)", nil)
		return
	}

	targetValue := 72.0
	targetUnit := "HOURS"

	if req.TargetValue != nil && *req.TargetValue > 0 {
		targetValue = *req.TargetValue
		if req.TargetUnit != nil && *req.TargetUnit != "" {
			targetUnit = *req.TargetUnit
		}
	} else if req.TargetHours > 0 {
		targetValue = req.TargetHours
		targetUnit = "HOURS"
	} else {
		// Use default from calendar if not provided
		if cal, err := h.repo.GetCalendarByID(c.Request.Context(), calendarID); err == nil && cal != nil {
			if cal.DeadlineTriggerValue > 0 {
				targetValue = cal.DeadlineTriggerValue
			}
			if cal.DeadlineTriggerUnit != "" {
				targetUnit = cal.DeadlineTriggerUnit
			}
		}
	}

	res, err := h.calSvc.CalculateArbitraryDeadlineWithUnit(c.Request.Context(), calendarID, closingTime, targetValue, targetUnit)
	if err != nil {
		response.InternalError(c, "Failed to calculate working deadline: "+err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Working deadline calculated", res)
}

func (h *CalendarHandler) GetTenderWorkingDeadline(c *gin.Context) {
	tenderID := c.Param("id")
	res, err := h.calSvc.CalculateTender72HourDeadline(c.Request.Context(), tenderID)
	if err != nil {
		response.InternalError(c, "Failed to compute tender deadline: "+err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Tender working deadline calculated", res)
}

func (h *CalendarHandler) ListTenderNotifications(c *gin.Context) {
	tenderID := c.Param("id")
	notifs, err := h.repo.ListNotificationsByTender(c.Request.Context(), tenderID)
	if err != nil {
		response.InternalError(c, "Failed to list tender notifications")
		return
	}
	escs, _ := h.repo.ListEscalationsByTender(c.Request.Context(), tenderID)

	response.Success(c, http.StatusOK, "Tender notifications and escalations retrieved", gin.H{
		"notifications": notifs,
		"escalations":   escs,
	})
}

func (h *CalendarHandler) UpdateChecklistPriority(c *gin.Context) {
	checklistID := c.Param("cid")
	if checklistID == "" {
		checklistID = c.Param("checklistId")
	}
	var req domain.UpdateChecklistPriorityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid checklist priority data", nil)
		return
	}

	if err := h.repo.UpdateChecklistPriorityAndAssignment(c.Request.Context(), checklistID, &req); err != nil {
		response.InternalError(c, "Failed to update checklist item: "+err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklist priority updated successfully", gin.H{"updated": true})
}

func (h *CalendarHandler) EvaluateDeadlines(c *gin.Context) {
	if err := h.calSvc.EvaluateActiveTenders(c.Request.Context()); err != nil {
		response.InternalError(c, "Failed to evaluate tender deadlines: "+err.Error())
		return
	}
	response.Success(c, http.StatusOK, "72-hour deadline evaluation completed successfully", gin.H{
		"evaluated_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *CalendarHandler) TriggerTenderRedZoneNotification(c *gin.Context) {
	tenderID := c.Param("id")
	force := c.Query("force") == "true"
	res, err := h.calSvc.TriggerRedZoneNotificationForTender(c.Request.Context(), tenderID, force)
	if err != nil {
		response.InternalError(c, "Failed to trigger Red Zone notification: "+err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Red Zone notification triggered", res)
}

func (h *CalendarHandler) GetTenderStakeholders(c *gin.Context) {
	tenderID := c.Param("id")
	stakeholders, err := h.calSvc.GetTenderStakeholders(c.Request.Context(), tenderID)
	if err != nil {
		response.InternalError(c, "Failed to fetch tender stakeholders: "+err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Tender stakeholders retrieved", stakeholders)
}

