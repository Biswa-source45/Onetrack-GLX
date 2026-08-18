package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/response"
)

type AlertHandler struct {
	svc domain.AlertService
}

func NewAlertHandler(svc domain.AlertService) *AlertHandler {
	return &AlertHandler{svc: svc}
}

func RegisterAlertRoutes(rg *gin.RouterGroup, h *AlertHandler, authMiddleware *middleware.AuthMiddleware) {
	alertsGroup := rg.Group("/alerts")
	alertsGroup.Use(authMiddleware.Authenticate())
	{
		alertsGroup.GET("", h.GetUserAlerts)
		alertsGroup.POST("", h.CreateAlert)
		alertsGroup.PUT("/:id/read", h.MarkAsRead)
		alertsGroup.PUT("/read-all", h.MarkAllAsRead)
	}
}

type createAlertReq struct {
	TargetRole string  `json:"target_role"`
	UserID     *string `json:"user_id"`
	BidID      *string `json:"bid_id"`
	CreatedBy  *string `json:"created_by"`
	Type       string  `json:"type"`
	Title      string  `json:"title"`
	Message    string  `json:"message"`
}

func (h *AlertHandler) CreateAlert(c *gin.Context) {
	var req createAlertReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid alert payload", nil)
		return
	}
	if req.Title == "" || req.Message == "" {
		response.BadRequest(c, "title and message are required", nil)
		return
	}

	createdBy := req.CreatedBy
	if createdBy == nil || *createdBy == "" {
		if uid := c.GetString("user_id"); uid != "" {
			createdBy = &uid
		}
	}

	alert := &domain.Alert{
		TargetRole: req.TargetRole,
		UserID:     req.UserID,
		BidID:      req.BidID,
		CreatedBy:  createdBy,
		Type:       req.Type,
		Title:      req.Title,
		Message:    req.Message,
	}
	if alert.Type == "" {
		alert.Type = "INFO"
	}
	if err := h.svc.CreateAlert(c.Request.Context(), alert); err != nil {
		response.InternalError(c, "Failed to create alert")
		return
	}
	response.Success(c, http.StatusCreated, "Alert created", alert)
}

func (h *AlertHandler) GetUserAlerts(c *gin.Context) {
	userID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	
	roleStr := "OPERATOR"
	if roles, ok := rolesVal.([]string); ok && len(roles) > 0 {
		roleStr = roles[0]
	}

	alerts, err := h.svc.GetUserAlerts(c.Request.Context(), userID, roleStr)
	if err != nil {
		response.InternalError(c, "Failed to retrieve alerts")
		return
	}

	if alerts == nil {
		alerts = []domain.Alert{}
	}

	response.Success(c, http.StatusOK, "Alerts retrieved", alerts)
}

func (h *AlertHandler) MarkAsRead(c *gin.Context) {
	alertID := c.Param("id")
	userID := c.GetString("user_id")

	if err := h.svc.MarkAsRead(c.Request.Context(), alertID, userID); err != nil {
		response.InternalError(c, "Failed to mark alert as read")
		return
	}

	response.Success(c, http.StatusOK, "Alert marked as read", nil)
}

func (h *AlertHandler) MarkAllAsRead(c *gin.Context) {
	userID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")

	roleStr := "OPERATOR"
	if roles, ok := rolesVal.([]string); ok && len(roles) > 0 {
		roleStr = roles[0]
	}

	if err := h.svc.MarkAllAsRead(c.Request.Context(), userID, roleStr); err != nil {
		response.InternalError(c, "Failed to mark all alerts as read")
		return
	}

	response.Success(c, http.StatusOK, "All alerts marked as read", nil)
}
