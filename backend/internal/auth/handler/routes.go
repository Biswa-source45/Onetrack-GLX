package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
)

func RegisterAuthRoutes(router *gin.RouterGroup, handler *AuthHandler, authMiddleware *middleware.AuthMiddleware) {
	auth := router.Group("/auth")
	{
		// Public routes (no authentication required)
		auth.POST("/login", handler.Login)
		auth.POST("/refresh", handler.Refresh)

		// Protected routes (authentication required)
		protected := auth.Group("")
		protected.Use(authMiddleware.Authenticate())
		{
			protected.POST("/logout", handler.Logout)
			protected.PATCH("/change-password", handler.ChangePassword)
		}

		// Admin-only routes
		admin := auth.Group("")
		admin.Use(authMiddleware.Authenticate(), authMiddleware.RequirePermission("user.edit"))
		{
			admin.PATCH("/force-reset", handler.ForceReset)
		}
	}
}
