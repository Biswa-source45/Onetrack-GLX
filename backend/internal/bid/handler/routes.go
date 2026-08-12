package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/middleware"
)

func RegisterBidRoutes(router *gin.RouterGroup, handler *BidHandler, authMiddleware *middleware.AuthMiddleware) {
	bids := router.Group("/bids")
	bids.Use(authMiddleware.Authenticate())
	{
		bids.POST("", authMiddleware.RequirePermission("bid.create"), handler.CreateBid)
		bids.GET("", authMiddleware.RequirePermission("bid.view"), handler.ListBids)
		bids.GET("/:id", authMiddleware.RequirePermission("bid.view"), handler.GetBid)
		bids.PATCH("/:id", authMiddleware.RequirePermission("bid.edit"), handler.UpdateBid)
		bids.DELETE("/:id", authMiddleware.RequirePermission("bid.delete"), handler.ArchiveBid)
		bids.POST("/:id/restore", authMiddleware.RequirePermission("bid.edit"), handler.RestoreBid)
		bids.DELETE("/:id/permanent", authMiddleware.RequirePermission("bid.delete"), handler.PermanentDeleteBid)

		// Lifecycle
		bids.POST("/:id/transition", authMiddleware.RequirePermission("bid.edit"), handler.TransitionStage)
		bids.GET("/:id/stage-history", authMiddleware.RequirePermission("bid.view"), handler.GetStageHistory)
		bids.GET("/audit-history", authMiddleware.RequirePermission("bid.view"), handler.GetGlobalAuditLogs)
		bids.GET("/performance-matrix", authMiddleware.RequirePermission("bid.view"), handler.GetTenderPerformanceMatrix)

		// Members
		bids.POST("/:id/members", authMiddleware.RequirePermission("bid.edit"), handler.AddMember)
		bids.DELETE("/:id/members/:user_id", authMiddleware.RequirePermission("bid.edit"), handler.RemoveMember)

		// Outcome
		bids.PATCH("/:id/outcome", authMiddleware.RequirePermission("bid.edit"), handler.RecordOutcome)

		// Checklists
		bids.GET("/:id/checklists", authMiddleware.RequirePermission("bid.view"), handler.GetChecklists)
		bids.POST("/:id/checklists", authMiddleware.RequirePermission("bid.edit"), handler.AddChecklist)
		bids.PUT("/:id/checklists/reorder", authMiddleware.RequirePermission("bid.edit"), handler.ReorderChecklists)
		bids.PATCH("/:id/checklists/:cid", authMiddleware.RequirePermission("bid.edit"), handler.ToggleChecklist)
		bids.PUT("/:id/checklists/:cid", authMiddleware.RequirePermission("bid.edit"), handler.UpdateChecklist)
		bids.DELETE("/:id/checklists/:cid", authMiddleware.RequirePermission("bid.edit"), handler.DeleteChecklist)
	}
}
