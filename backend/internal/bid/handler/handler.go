package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/bid/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

type BidHandler struct {
	svc domain.BidService
}

func NewBidHandler(svc domain.BidService) *BidHandler {
	return &BidHandler{svc: svc}
}

func (h *BidHandler) CreateBid(c *gin.Context) {
	var req domain.CreateBidRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	bid, err := h.svc.CreateBid(c.Request.Context(), &req, actorID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, http.StatusCreated, "Bid workspace created successfully", bid)
}

func (h *BidHandler) GetBid(c *gin.Context) {
	id := c.Param("id")
	bid, err := h.svc.GetBid(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Bid retrieved", bid)
}

func (h *BidHandler) ListBids(c *gin.Context) {
	params := domain.ListBidsParams{
		Page:          parseIntQuery(c, "page", 1),
		Limit:         parseIntQuery(c, "limit", 20),
		Search:        c.Query("search"),
		WorkflowStage: c.Query("workflow_stage"),
		BidStatus:     c.Query("bid_status"),
		BidOutcome:    c.Query("bid_outcome"),
		BidOwnerID:    c.Query("bid_owner_id"),
		Category:      c.Query("category"),
		CreationMode:  c.Query("creation_mode"),
	}

	if v := c.Query("closing_before"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			params.ClosingBefore = &t
		}
	}
	if v := c.Query("closing_after"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			params.ClosingAfter = &t
		}
	}
	if v := c.Query("oem_required"); v != "" {
		b := v == "true"
		params.OEMRequired = &b
	}

	result, err := h.svc.ListBids(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result.Bids,
		"meta": gin.H{
			"page":         result.Page,
			"limit":        result.Limit,
			"total":        result.Total,
			"total_pages":  result.TotalPages,
			"active_count": result.ActiveCount,
			"won_count":    result.WonCount,
			"lost_count":   result.LostCount,
		},
	})
}

func (h *BidHandler) UpdateBid(c *gin.Context) {
	id := c.Param("id")
	var req domain.UpdateBidRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	if err := h.svc.UpdateBid(c.Request.Context(), id, &req); err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Bid updated successfully", nil)
}

func (h *BidHandler) TransitionStage(c *gin.Context) {
	id := c.Param("id")
	var req domain.TransitionStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	result, err := h.svc.TransitionStage(c.Request.Context(), id, &req, actorID)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}

	response.Success(c, http.StatusOK, "Bid stage transitioned successfully", result)
}

func (h *BidHandler) GetStageHistory(c *gin.Context) {
	id := c.Param("id")
	history, err := h.svc.GetStageHistory(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Stage history retrieved", history)
}

func (h *BidHandler) AddMember(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	if err := h.svc.AddMember(c.Request.Context(), bidID, &req, actorID); err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Member added to workspace", nil)
}

func (h *BidHandler) RemoveMember(c *gin.Context) {
	bidID := c.Param("id")
	userID := c.Param("user_id")
	if err := h.svc.RemoveMember(c.Request.Context(), bidID, userID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Member removed from workspace", nil)
}

func (h *BidHandler) RecordOutcome(c *gin.Context) {
	id := c.Param("id")
	var req domain.RecordOutcomeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	if err := h.svc.RecordOutcome(c.Request.Context(), id, &req); err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Bid outcome recorded", nil)
}

func (h *BidHandler) ArchiveBid(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.ArchiveBid(c.Request.Context(), id); err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Bid archived successfully", nil)
}

func (h *BidHandler) AddChecklist(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.AddChecklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	item, err := h.svc.AddChecklist(c.Request.Context(), bidID, &req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Checklist item added", item)
}

func (h *BidHandler) UpdateChecklist(c *gin.Context) {
	bidID := c.Param("id")
	checklistID := c.Param("cid")
	var req domain.UpdateChecklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	item, err := h.svc.UpdateChecklist(c.Request.Context(), bidID, checklistID, &req)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklist item updated", item)
}

func (h *BidHandler) DeleteChecklist(c *gin.Context) {
	bidID := c.Param("id")
	checklistID := c.Param("cid")
	if err := h.svc.DeleteChecklist(c.Request.Context(), bidID, checklistID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklist item deleted", nil)
}

func (h *BidHandler) ReorderChecklists(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.ReorderChecklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	items, err := h.svc.ReorderChecklists(c.Request.Context(), bidID, &req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklists reordered", items)
}

func (h *BidHandler) GetChecklists(c *gin.Context) {
	bidID := c.Param("id")
	items, err := h.svc.GetChecklists(c.Request.Context(), bidID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklists retrieved", items)
}

func (h *BidHandler) ToggleChecklist(c *gin.Context) {
	bidID := c.Param("id")
	checklistID := c.Param("cid")

	var req struct {
		IsDone bool `json:"is_done"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	item, err := h.svc.ToggleChecklist(c.Request.Context(), bidID, checklistID, req.IsDone, actorID)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklist updated", item)
}

func parseIntQuery(c *gin.Context, key string, def int) int {
	v := c.Query(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return def
	}
	return n
}
