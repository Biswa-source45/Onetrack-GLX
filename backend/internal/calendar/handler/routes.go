package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
)

func RegisterCalendarRoutes(
	r *gin.RouterGroup,
	h *CalendarHandler,
	auth *middleware.AuthMiddleware,
) {
	// All calendar endpoints require authentication
	cal := r.Group("/calendars", auth.Authenticate())
	{
		// Viewing calendars & holidays
		cal.GET("", h.ListCalendars)
		cal.GET("/default", h.GetDefaultCalendar)
		cal.GET("/:id", h.GetCalendarByID)
		cal.GET("/:id/holidays", h.ListHolidays)
		cal.GET("/:id/exceptions", h.ListExceptions)
		cal.GET("/:id/google-sync", h.GetGoogleIntegration)
		cal.GET("/:id/google-sync/logs", h.ListSyncLogs)
		cal.POST("/:id/calculate", h.CalculateArbitraryDeadline)

		// Administration & modifications (strictly SUPER_ADMIN and ADMIN only)
		adminOnly := auth.RequireAnyRole("SUPER_ADMIN", "ADMIN")
		cal.PUT("/:id", adminOnly, h.UpdateCalendar)
		cal.POST("/:id/holidays", adminOnly, h.CreateHoliday)
		cal.PUT("/:id/holidays/:holidayId", adminOnly, h.UpdateHoliday)
		cal.DELETE("/:id/holidays/:holidayId", adminOnly, h.DeleteHoliday)
		cal.POST("/:id/exceptions", adminOnly, h.CreateException)
		cal.DELETE("/:id/exceptions/:exceptionId", adminOnly, h.DeleteException)
		cal.POST("/:id/google-sync", adminOnly, h.ConfigureGoogleIntegration)
		cal.POST("/:id/google-sync/trigger", adminOnly, h.TriggerGoogleSync)
		cal.POST("/evaluate-deadlines", adminOnly, h.EvaluateDeadlines)
	}

	// Tender-scoped working calendar and deadline endpoints (support both /bids and /tenders)
	for _, prefix := range []string{"/bids", "/tenders"} {
		grp := r.Group(prefix, auth.Authenticate())
		{
			grp.GET("/:id/working-deadline", h.GetTenderWorkingDeadline)
			grp.GET("/:id/deadline-notifications", h.ListTenderNotifications)
			grp.GET("/:id/stakeholders", h.GetTenderStakeholders)
			grp.POST("/:id/trigger-red-zone-notification", h.TriggerTenderRedZoneNotification)
		}
	}

	// Checklist priority update
	checklists := r.Group("/checklists", auth.Authenticate())
	{
		checklists.PUT("/:cid/priority", h.UpdateChecklistPriority)
	}
}
