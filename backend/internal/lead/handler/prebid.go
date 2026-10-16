package handler

import (
	"fmt"
	"html"
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/lead/domain"
	"github.com/onetrack/backend/internal/platform/response"
	"github.com/onetrack/backend/internal/platform/roles"
)

// PrebidTransition takes one step of the prebid query round: start it, hand the
// sheet to Pre-Sales / Delivery / Bid Manager, take it back, mark it sent to the
// customer, close it. The rules live in domain.Lead.PrebidNext.
func (h *LeadHandler) PrebidTransition(c *gin.Context) {
	ctx, id, actor := c.Request.Context(), c.Param("id"), actorOf(c)
	var req domain.PrebidTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request", nil)
		return
	}
	if err := req.Normalize(); err != nil {
		fail(c, err)
		return
	}
	lead, err := h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	next, err := lead.PrebidNext(req.Action, actor)
	if err != nil {
		fail(c, err)
		return
	}
	if req.Action == domain.PbMarkSent {
		if err := lead.PrebidReadyToSend(); err != nil {
			fail(c, err)
			return
		}
	}

	var assigneeID, note *string
	if want, hands := domain.PrebidAssigneeRoles[req.Action]; hands {
		ok, err := h.repo.UserHasAnyRole(ctx, req.AssigneeID, roles.Holders(want...))
		if err != nil {
			fail(c, err)
			return
		}
		if !ok {
			response.BadRequest(c, "The person you chose must be an active "+assigneeLabel(req.Action), nil)
			return
		}
		assigneeID = &req.AssigneeID
	}
	if req.Note != "" {
		note = &req.Note
	}
	if err := h.repo.PrebidTransition(ctx, id, lead.Prebid.Stage, next, req.Action, actor.ID, assigneeID, note); err != nil {
		fail(c, err)
		return
	}

	lead, err = h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	h.notifyPrebid(lead, req.Action, actor.ID, req.Note)
	h.forActor(lead, actor)
	response.Success(c, http.StatusOK, "Prebid sheet updated", lead)
}

// AddPrebidItem appends an empty row for whoever may add rows right now.
func (h *LeadHandler) AddPrebidItem(c *gin.Context) {
	ctx, id, actor := c.Request.Context(), c.Param("id"), actorOf(c)
	lead, err := h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	if !lead.CanChangePrebidRows(actor) {
		response.Forbidden(c, "You cannot add rows to the prebid sheet right now")
		return
	}
	item, err := h.repo.AddPrebidItem(ctx, id, lead.Prebid.Stage, actor.ID)
	if err != nil {
		fail(c, err)
		return
	}
	response.Success(c, http.StatusCreated, "Row added", item)
}

// UpdatePrebidItem saves cells of one row. Each field is checked against what
// the caller may edit at the sheet's current stage — the server is the only
// thing keeping, say, the Delivery Manager out of the Query column.
func (h *LeadHandler) UpdatePrebidItem(c *gin.Context) {
	ctx, id, actor := c.Request.Context(), c.Param("id"), actorOf(c)
	var body map[string]string
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "invalid request", nil)
		return
	}
	fields, err := domain.NormalizePrebidEdit(body)
	if err != nil {
		fail(c, err)
		return
	}
	lead, err := h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	editable := lead.PrebidEditableFields(actor)
	for f := range fields {
		if !slices.Contains(editable, f) {
			response.Forbidden(c, "You cannot edit that column right now")
			return
		}
	}
	item, err := h.repo.UpdatePrebidItem(ctx, id, c.Param("itemId"), lead.Prebid.Stage, fields)
	if err != nil {
		fail(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Saved", item)
}

func (h *LeadHandler) DeletePrebidItem(c *gin.Context) {
	ctx, id, actor := c.Request.Context(), c.Param("id"), actorOf(c)
	lead, err := h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	if !lead.CanChangePrebidRows(actor) {
		response.Forbidden(c, "You cannot delete rows from the prebid sheet right now")
		return
	}
	if err := h.repo.DeletePrebidItem(ctx, id, c.Param("itemId"), lead.Prebid.Stage); err != nil {
		fail(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Row deleted", nil)
}

// ── Notifications ───────────────────────────────────────────────────────────

func assigneeLabel(action string) string {
	switch action {
	case domain.PbSendDM:
		return "Delivery Manager"
	case domain.PbSendBM:
		return "Bid Manager"
	default:
		return "Pre-Sales user"
	}
}

// eventActorName: the name behind actorID, read off the lead's timeline (the
// step just taken is its last entry).
func eventActorName(l *domain.Lead, actorID string) string {
	for i := len(l.Events) - 1; i >= 0; i-- {
		if l.Events[i].Actor.ID == actorID {
			return l.Events[i].Actor.FullName
		}
	}
	return "Someone"
}

// notifyPrebid alerts the person the sheet just went to, or the lead's owner
// when it comes back. Best-effort, like every lead notification.
func (h *LeadHandler) notifyPrebid(l *domain.Lead, action, actorID, note string) {
	who := html.EscapeString(eventActorName(l, actorID))
	body := func(text string) string {
		if note == "" {
			return text
		}
		return text + fmt.Sprintf(`</p><p style="margin-top:12px;padding:10px 14px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;color:#78350f;"><strong>Note:</strong> %s`,
			html.EscapeString(note))
	}
	name := leadName(l)
	assignee := ""
	if l.Prebid.Assignee != nil {
		assignee = l.Prebid.Assignee.ID
	}
	const ask = "LEAD_PREBID_REQUEST"
	switch action {
	case domain.PbStart, domain.PbSendPM:
		h.notify(l, actorID, ask, "Prebid input needed: "+name,
			body(who+" needs your Product / OEM list and remarks for the prebid queries of this lead."), assignee)
	case domain.PbSendDM:
		h.notify(l, actorID, ask, "Prebid input needed: "+name,
			body(who+" needs your delivery comments on each product for the prebid queries of this lead."), assignee)
	case domain.PbSendBM:
		h.notify(l, actorID, ask, "Prebid input needed: "+name,
			body(who+" needs your comments on each product for the prebid queries of this lead."), assignee)
	case domain.PbReturn:
		h.notify(l, actorID, "LEAD_PREBID_RETURNED", "Prebid sheet is back with you: "+name,
			body(who+" returned the prebid sheet of this lead to you."), l.LeadOwner.ID)
	}
}
