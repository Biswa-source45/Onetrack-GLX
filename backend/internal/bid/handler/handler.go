package handler

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
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
		if errors.Is(err, domain.ErrDuplicateIdentifier) {
			response.Conflict(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
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
		InBin:         c.Query("in_bin") == "true" || c.Query("show_deleted") == "true",
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
			"page":            result.Page,
			"limit":           result.Limit,
			"total":           result.Total,
			"total_pages":     result.TotalPages,
			"active_count":    result.ActiveCount,
			"won_count":       result.WonCount,
			"lost_count":      result.LostCount,
			"cancelled_count": result.CancelledCount,
			"closed_count":    result.ClosedCount,
			"tech_eval_count": result.TechEvalCount,
			"submitted_count": result.SubmittedCount,
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
	actorID := c.GetString("user_id")
	rolesVal, _ := c.Get("roles")
	actorRoles, _ := rolesVal.([]string)
	if err := h.svc.UpdateBid(c.Request.Context(), id, &req, actorID, actorRoles); err != nil {
		if errors.Is(err, domain.ErrDuplicateIdentifier) {
			response.Conflict(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrForbidden) {
			response.Forbidden(c, err.Error())
			return
		}
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "Bid not found")
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Bid updated successfully", nil)
}

// GetGlobalAuditLogs serves both the global "Database Audit Trail" panel and
// the per-person "Activity Log" (?user_id=) off the same paginated feed.
// ?limit= and ?cursor= (opaque, from a previous page's meta.next_cursor)
// page it — the whole point being that a caller can never pull the entire
// table in one response.
func (h *BidHandler) GetGlobalAuditLogs(c *gin.Context) {
	userID := c.Query("user_id")
	// Reading a colleague's own action history — not just the tender-scoped
	// global trail everyone with bid.view already sees — is restricted to
	// Super Admin, Admin, and Manager, matching the same gate the frontend
	// already applies to the rest of User Management.
	if userID != "" {
		rolesVal, _ := c.Get("roles")
		roles, _ := rolesVal.([]string)
		allowed := false
		for _, r := range roles {
			if personaLogRoles[r] {
				allowed = true
				break
			}
		}
		if !allowed {
			response.Forbidden(c, "Only Super Admin, Admin, or Manager can view another user's activity log")
			return
		}
	}

	q := domain.AuditLogQuery{
		Limit:  parseIntQuery(c, "limit", 30),
		Cursor: c.Query("cursor"),
	}
	page, err := h.svc.GetGlobalAuditLogs(c.Request.Context(), q, userID)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidCursor) {
			response.BadRequest(c, "Invalid or expired cursor", nil)
			return
		}
		response.InternalError(c, err.Error())
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

// personaLogRoles gates the per-person Activity Log. Deliberately narrower
// than managementRoles below (no Account Manager) — seeing a colleague's
// full action history is a people-management capability, not a sales one.
var personaLogRoles = map[string]bool{"SUPER_ADMIN": true, "ADMIN": true, "MANAGER": true}

// managementRoles can see every owner's row in the performance matrix;
// everyone else (Bid Executive, Pre-Sales, Finance, ...) only sees their own.
var managementRoles = map[string]bool{"SUPER_ADMIN": true, "ADMIN": true, "MANAGER": true, "ACCOUNT_MANAGER": true}

func (h *BidHandler) GetTenderPerformanceMatrix(c *gin.Context) {
	ownerID := ""
	rolesVal, _ := c.Get("roles")
	roles, _ := rolesVal.([]string)
	isManagement := false
	for _, r := range roles {
		if managementRoles[r] {
			isManagement = true
			break
		}
	}
	if !isManagement {
		ownerID = c.GetString("user_id")
	}

	stats, err := h.svc.GetTenderPerformanceMatrix(c.Request.Context(), ownerID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Tender performance matrix retrieved", stats)
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

// GetStageHistory serves one tender's History tab, paginated the same way
// as GetGlobalAuditLogs (?limit=, ?cursor=) so a heavily-edited tender can't
// pull its whole history into one response either.
func (h *BidHandler) GetStageHistory(c *gin.Context) {
	id := c.Param("id")
	q := domain.AuditLogQuery{
		Limit:  parseIntQuery(c, "limit", 30),
		Cursor: c.Query("cursor"),
	}
	page, err := h.svc.GetStageHistory(c.Request.Context(), id, q)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidCursor) {
			response.BadRequest(c, "Invalid or expired cursor", nil)
			return
		}
		response.NotFound(c, "Bid not found")
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

func (h *BidHandler) AddMicroEvent(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.AddMicroEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	event, err := h.svc.AddMicroEvent(c.Request.Context(), bidID, &req, actorID)
	if err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusCreated, "Event logged", event)
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
	actorID := c.GetString("user_id")
	if err := h.svc.RemoveMember(c.Request.Context(), bidID, userID, actorID); err != nil {
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
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
	actorID := c.GetString("user_id")
	if err := h.svc.RecordOutcome(c.Request.Context(), id, &req, actorID); err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Bid outcome recorded", nil)
}

func (h *BidHandler) ArchiveBid(c *gin.Context) {
	id := c.Param("id")
	actorID := c.GetString("user_id")
	if err := h.svc.ArchiveBid(c.Request.Context(), id, actorID); err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Bid moved to Tender Bin successfully", nil)
}

func (h *BidHandler) RestoreBid(c *gin.Context) {
	id := c.Param("id")
	actorID := c.GetString("user_id")
	if err := h.svc.RestoreBid(c.Request.Context(), id, actorID); err != nil {
		// A restore can fail because another tender took this one's identifier
		// while it sat in the bin. That is a conflict, not a missing record, and
		// the user needs to be told which tender is in the way.
		if errors.Is(err, domain.ErrDuplicateIdentifier) {
			response.Conflict(c, err.Error())
			return
		}
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Bid restored successfully", nil)
}

func (h *BidHandler) PermanentDeleteBid(c *gin.Context) {
	id := c.Param("id")
	actorID := c.GetString("user_id")
	if err := h.svc.PermanentDeleteBid(c.Request.Context(), id, actorID); err != nil {
		response.NotFound(c, "Bid not found")
		return
	}
	response.Success(c, http.StatusOK, "Bid permanently deleted", nil)
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

// ListFieldSuggestions serves Field Memory autocomplete: the remembered
// values for one field (?field=organization_name), ranked by usage.
func (h *BidHandler) ListFieldSuggestions(c *gin.Context) {
	field := c.Query("field")
	suggestions, err := h.svc.ListFieldSuggestions(c.Request.Context(), field)
	if err != nil {
		if errors.Is(err, domain.ErrValidation) {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Field suggestions retrieved", suggestions)
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
