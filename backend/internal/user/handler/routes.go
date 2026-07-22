package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
)

func RegisterUserRoutes(router *gin.RouterGroup, handler *UserHandler, authMiddleware *middleware.AuthMiddleware) {
	users := router.Group("/users")
	users.Use(authMiddleware.Authenticate())
	{
		// Self-service (any authenticated user)
		users.GET("/me", handler.GetMyProfile)

		// Admin routes (require specific permissions)
		users.POST("", authMiddleware.RequirePermission("user.create"), handler.CreateUser)
		users.GET("", authMiddleware.RequirePermission("user.view"), handler.ListUsers)
		users.GET("/:id", authMiddleware.RequirePermission("user.view"), handler.GetUser)
		users.PATCH("/:id", authMiddleware.RequirePermission("user.edit"), handler.UpdateUser)
		users.PATCH("/:id/status", authMiddleware.RequirePermission("user.deactivate"), handler.UpdateStatus)
		users.PATCH("/:id/roles", authMiddleware.RequirePermission("user.assign_role"), handler.UpdateRoles)
		users.PATCH("/:id/permissions", authMiddleware.RequirePermission("user.assign_role"), handler.UpdatePermissions)
	}
}
