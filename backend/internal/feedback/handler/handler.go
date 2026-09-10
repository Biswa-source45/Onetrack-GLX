package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/feedback/domain"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/pagination"
	"github.com/onetrack/backend/internal/platform/response"
)

type TicketHandler struct {
	svc domain.TicketService
}

func NewTicketHandler(svc domain.TicketService) *TicketHandler {
	return &TicketHandler{svc: svc}
}

func RegisterTicketRoutes(rg *gin.RouterGroup, h *TicketHandler, authMiddleware *middleware.AuthMiddleware) {
	tickets := rg.Group("/tickets")
	tickets.Use(authMiddleware.Authenticate())
	{
		// Open to every authenticated user — "Implement Feedback for all
		// users" — no permission gate beyond being logged in.
		tickets.POST("", h.CreateTicket)
		tickets.GET("/mine", h.ListMyTickets)
		tickets.GET("/:id", h.GetTicket)
		tickets.GET("/:id/history", h.GetTicketHistory)

		// Triage is Super Admin only — same one-line gate Bulk Import
		// already uses, nothing new to build for it.
		tickets.GET("", authMiddleware.RequireRole("SUPER_ADMIN"), h.ListAllTickets)
		tickets.GET("/open-count", authMiddleware.RequireRole("SUPER_ADMIN"), h.CountOpen)
		tickets.PATCH("/:id/status", authMiddleware.RequireRole("SUPER_ADMIN"), h.UpdateStatus)
	}
}

func (h *TicketHandler) CreateTicket(c *gin.Context) {
	// Super Admin is who Feedback Loop notifies, not who it collects from —
	// enforced here too, not just by hiding the tab in the sidebar.
	if hasRole(c, "SUPER_ADMIN") {
		response.Forbidden(c, "Super Admin manages feedback, not submit it")
		return
	}
	var req domain.CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	userID := c.GetString("user_id")
	ticket, err := h.svc.CreateTicket(c.Request.Context(), &req, userID)
	if err != nil {
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Feedback submitted", ticket)
}

func (h *TicketHandler) ListMyTickets(c *gin.Context) {
	userID := c.GetString("user_id")
	page, err := h.svc.ListMyTickets(c.Request.Context(), userID, parseListParams(c))
	respondPage(c, page, err)
}

func (h *TicketHandler) ListAllTickets(c *gin.Context) {
	params := parseListParams(c)
	params.Status = c.Query("status")
	params.Category = c.Query("category")
	page, err := h.svc.ListAllTickets(c.Request.Context(), params)
	respondPage(c, page, err)
}

func respondPage(c *gin.Context, page *domain.TicketListPage, err error) {
	if err != nil {
		if errors.Is(err, pagination.ErrInvalidCursor) {
			response.BadRequest(c, "Invalid or expired cursor", nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    page.Items,
		"meta": gin.H{
			"next_cursor": page.NextCursor,
			"has_more":    page.HasMore,
		},
	})
}

func parseListParams(c *gin.Context) domain.ListTicketsParams {
	limit := 30
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	return domain.ListTicketsParams{Limit: limit, Cursor: c.Query("cursor")}
}

func (h *TicketHandler) GetTicket(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	isSuperAdmin := hasRole(c, "SUPER_ADMIN")
	ticket, err := h.svc.GetTicket(c.Request.Context(), id, userID, isSuperAdmin)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, "You can only view your own feedback")
			return
		}
		response.NotFound(c, "Ticket not found")
		return
	}
	response.Success(c, http.StatusOK, "Ticket retrieved", ticket)
}

func (h *TicketHandler) GetTicketHistory(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	isSuperAdmin := hasRole(c, "SUPER_ADMIN")
	history, err := h.svc.GetStatusHistory(c.Request.Context(), id, userID, isSuperAdmin)
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, "You can only view your own feedback")
			return
		}
		response.NotFound(c, "Ticket not found")
		return
	}
	response.Success(c, http.StatusOK, "Ticket history retrieved", history)
}

func (h *TicketHandler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var req domain.UpdateTicketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	if err := h.svc.UpdateStatus(c.Request.Context(), id, &req, actorID); err != nil {
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.NotFound(c, "Ticket not found")
		return
	}
	response.Success(c, http.StatusOK, "Ticket status updated", nil)
}

func (h *TicketHandler) CountOpen(c *gin.Context) {
	count, err := h.svc.CountOpen(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Open ticket count retrieved", gin.H{"open_count": count})
}

func hasRole(c *gin.Context, role string) bool {
	rolesVal, _ := c.Get("roles")
	roles, _ := rolesVal.([]string)
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}
