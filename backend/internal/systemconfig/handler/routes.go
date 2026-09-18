package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
)

// RegisterRoutes mounts system configuration endpoints:
// - GET /system/config: all authenticated users (needed for frontend UI workflow flags)
// - GET /system/config/:key: all authenticated users
// - PUT /system/config/:key: Super Admin only
func RegisterRoutes(router *gin.RouterGroup, h *Handler, authMiddleware *middleware.AuthMiddleware) {
	configGroup := router.Group("/system/config")
	configGroup.Use(authMiddleware.Authenticate())
	{
		configGroup.GET("", h.GetAll)
		configGroup.GET("/:key", h.Get)
		configGroup.PUT("/:key", authMiddleware.RequireRole("SUPER_ADMIN"), h.Update)
	}
}
