package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
)

// RegisterTaskRoutes registers two groups:
//  1. /bids/:id/tasks  — task creation and listing scoped to a bid
//  2. /tasks/:id       — individual task operations (status, assign, subtasks, activities, checklists)
//
// This separation ensures the bid module routes (/bids) are not polluted with
// task sub-resources while keeping task management centralized for both
// MANUAL and INTELLIGENCE modes.
func RegisterTaskRoutes(router *gin.RouterGroup, handler *TaskHandler, authMiddleware *middleware.AuthMiddleware) {
	// ── My Tasks: cross-bid view for the authenticated user ──────────────────
	me := router.Group("/me")
	me.Use(authMiddleware.Authenticate())
	{
		me.GET("/tasks", authMiddleware.RequirePermission("task.view"), handler.MyTasks)
	}

	// ── Tasks scoped to a bid workspace ──────────────────────────────────────
	bidTasks := router.Group("/bids/:id/tasks")
	bidTasks.Use(authMiddleware.Authenticate())
	{
		// Generic task creation (any task_type via task_type field)
		bidTasks.POST("", authMiddleware.RequirePermission("task.create"), handler.CreateTask)
		bidTasks.GET("", authMiddleware.RequirePermission("task.view"), handler.ListTasksForBid)

		// Typed task creation — dedicated endpoints per type
		// These set the correct metadata structure at creation time
		bidTasks.POST("/approval", authMiddleware.RequirePermission("task.create"), handler.CreateApprovalTask)
		bidTasks.POST("/oem", authMiddleware.RequirePermission("task.create"), handler.CreateOEMTask)
		bidTasks.POST("/document", authMiddleware.RequirePermission("task.create"), handler.CreateDocumentTask)
	}

	// ── Individual task operations ────────────────────────────────────────────
	tasks := router.Group("/tasks")
	tasks.Use(authMiddleware.Authenticate())
	{
		tasks.GET("/:id", authMiddleware.RequirePermission("task.view"), handler.GetTask)
		tasks.PATCH("/:id", authMiddleware.RequirePermission("task.edit"), handler.UpdateTask)
		tasks.DELETE("/:id", authMiddleware.RequirePermission("task.delete"), handler.DeleteTask)

		tasks.PATCH("/:id/status", authMiddleware.RequirePermission("task.edit"), handler.UpdateStatus)
		tasks.PATCH("/:id/assign", authMiddleware.RequirePermission("task.assign"), handler.AssignTask)

		// Type-specific action endpoints
		tasks.POST("/:id/approve", authMiddleware.RequirePermission("task.edit"), handler.SubmitApprovalDecision)
		tasks.POST("/:id/oem-followup", authMiddleware.RequirePermission("task.edit"), handler.AddOEMFollowUp)

		// Subtasks
		tasks.POST("/:id/subtasks", authMiddleware.RequirePermission("task.create"), handler.CreateSubtask)
		tasks.GET("/:id/subtasks", authMiddleware.RequirePermission("task.view"), handler.GetSubtasks)

		// Activity timeline
		tasks.POST("/:id/activities", authMiddleware.RequirePermission("task.edit"), handler.AddActivity)
		tasks.GET("/:id/activities", authMiddleware.RequirePermission("task.view"), handler.ListActivities)

		// Checklists
		tasks.POST("/:id/checklists", authMiddleware.RequirePermission("task.edit"), handler.AddChecklist)
		tasks.GET("/:id/checklists", authMiddleware.RequirePermission("task.view"), handler.GetChecklists)
		tasks.PATCH("/:id/checklists/:cid", authMiddleware.RequirePermission("task.edit"), handler.UpdateChecklist)
		tasks.DELETE("/:id/checklists/:cid", authMiddleware.RequirePermission("task.edit"), handler.DeleteChecklist)
	}
}
