package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/chat/domain"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/response"
)

type ChatHandler struct {
	svc domain.ChatService
}

func NewChatHandler(svc domain.ChatService) *ChatHandler {
	return &ChatHandler{svc: svc}
}

func RegisterRoutes(r *gin.RouterGroup, h *ChatHandler, authMiddleware *middleware.AuthMiddleware) {
	bids := r.Group("/bids/:id/chat")
	bids.Use(authMiddleware.Authenticate())
	{
		// Same gate as viewing the tender itself.
		view := authMiddleware.RequirePermission("bid.view")
		bids.GET("", view, h.ListMessages)
		bids.POST("", view, h.SendMessage)
		bids.GET("/members", view, h.GetMembers)
	}
}

func (h *ChatHandler) ListMessages(c *gin.Context) {
	bidID := c.Param("id")
	if bidID == "" {
		response.BadRequest(c, "Bid ID is required", nil)
		return
	}

	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	messages, err := h.svc.ListMessages(c.Request.Context(), bidID, limit, offset)
	if err != nil {
		response.InternalError(c, "Failed to load chat messages")
		return
	}

	response.Success(c, http.StatusOK, "Messages loaded successfully", messages)
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
	bidID := c.Param("id")
	if bidID == "" {
		response.BadRequest(c, "Bid ID is required", nil)
		return
	}

	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "Authentication required")
		return
	}

	var req domain.CreateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	msg, err := h.svc.SendMessage(c.Request.Context(), bidID, userID, &req)
	if errors.Is(err, domain.ErrBidNotFound) {
		response.NotFound(c, "Tender not found")
		return
	}
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	response.Success(c, http.StatusCreated, "Message posted successfully", msg)
}

func (h *ChatHandler) GetMembers(c *gin.Context) {
	bidID := c.Param("id")
	if bidID == "" {
		response.BadRequest(c, "Bid ID is required", nil)
		return
	}

	members, err := h.svc.GetMembers(c.Request.Context(), bidID)
	if err != nil {
		response.InternalError(c, "Failed to load members for mentions")
		return
	}

	response.Success(c, http.StatusOK, "Members loaded successfully", members)
}
