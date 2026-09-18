package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/platform/response"
	"github.com/onetrack/backend/internal/systemlog/domain"
)

type Handler struct {
	svc domain.Service
}

func NewHandler(svc domain.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	q := domain.ListQuery{
		Limit:    limit,
		Cursor:   c.Query("cursor"),
		Category: c.Query("category"),
	}
	page, err := h.svc.List(c.Request.Context(), q)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidCursor) {
			response.BadRequest(c, "Invalid or expired cursor", nil)
			return
		}
		response.InternalError(c, "Failed to load system logs")
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
