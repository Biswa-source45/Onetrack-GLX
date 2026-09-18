package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/platform/response"
	"github.com/onetrack/backend/internal/systemconfig/domain"
)

type Handler struct {
	svc domain.Service
}

func NewHandler(svc domain.Service) *Handler {
	return &Handler{svc: svc}
}

// GetAll returns all platform configuration keys and values.
func (h *Handler) GetAll(c *gin.Context) {
	configs, err := h.svc.GetAllConfigs(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to load system configurations")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    configs,
	})
}

// Get returns a single configuration by key.
func (h *Handler) Get(c *gin.Context) {
	key := c.Param("key")
	config, err := h.svc.GetConfig(c.Request.Context(), key)
	if err != nil {
		response.InternalError(c, "Failed to load configuration")
		return
	}
	if config == nil {
		response.NotFound(c, "Configuration key not found")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    config,
	})
}

// Update updates a configuration by key (Super Admin only).
func (h *Handler) Update(c *gin.Context) {
	key := c.Param("key")
	var req domain.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request payload: 'value' is required", err)
		return
	}

	actorID := c.GetString("user_id")
	if err := h.svc.UpdateConfig(c.Request.Context(), key, req.Value, actorID); err != nil {
		response.InternalError(c, "Failed to update configuration")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Configuration updated successfully",
	})
}
