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
	bidView := auth.RequirePermission("bid.view")
	bidEdit := auth.RequirePermission("bid.edit")
	adminOnly := auth.RequireAnyRole("SUPER_ADMIN", "ADMIN")

	cal := r.Group("/calendars", auth.Authenticate())
	{
		// Calendar rules are readable by any signed-in user (the tender form and banner use them).
		cal.GET("/default", h.GetDefaultCalendar)
		cal.GET("/:id/holidays", h.ListHolidays)
		cal.GET("/:id/exceptions", h.ListExceptions)
		cal.GET("/:id/google-sync", h.GetGoogleIntegration)
		cal.GET("/:id/google-sync/logs", h.ListSyncLogs)

		// Administration (SUPER_ADMIN and ADMIN only)
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

	// Tender-scoped deadline endpoints (both /bids and /tenders prefixes).
	for _, prefix := range []string{"/bids", "/tenders"} {
		grp := r.Group(prefix, auth.Authenticate())
		{
			grp.GET("/:id/working-deadline", bidView, h.GetTenderWorkingDeadline)
			// force=true (re-send) is further restricted to admins in the handler.
			grp.POST("/:id/trigger-red-zone-notification", bidEdit, h.TriggerTenderRedZoneNotification)
		}
	}

	r.Group("/checklists", auth.Authenticate()).PUT("/:cid/priority", bidEdit, h.UpdateChecklistPriority)
}
