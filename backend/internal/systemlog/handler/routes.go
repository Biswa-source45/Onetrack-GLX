package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
)

// RegisterRoutes mounts the System Logs page's one read endpoint —
// Super Admin only, per the feature's "left sidebar, Super Admin" scope.
func RegisterRoutes(router *gin.RouterGroup, h *Handler, authMiddleware *middleware.AuthMiddleware) {
	logs := router.Group("/system-logs")
	logs.Use(authMiddleware.Authenticate(), authMiddleware.RequireRole("SUPER_ADMIN"))
	{
		logs.GET("", h.List)
	}
}
