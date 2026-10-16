package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/lead/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

// Publish converts an unpublished lead to a published one: the RFP is out, so the tender
// details are captured now. One way only — see domain.Lead.PublishNext. The RFP documents
// are uploaded afterwards through the usual document endpoint.
func (h *LeadHandler) Publish(c *gin.Context) {
	ctx, id, actor := c.Request.Context(), c.Param("id"), actorOf(c)
	var req domain.PublishRequest
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
	if err := lead.PublishNext(actor); err != nil {
		fail(c, err)
		return
	}
	if err := h.repo.Publish(ctx, id, req.Title, req.PublishedDetails, actor.ID); err != nil {
		fail(c, err)
		return
	}

	lead, err = h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	h.notifyPublished(lead, actor.ID)
	h.forActor(lead, actor)
	response.Success(c, http.StatusOK, "Lead published", lead)
}

// notifyPublished tells the people who already follow the lead that its RFP is out.
func (h *LeadHandler) notifyPublished(l *domain.Lead, actorID string) {
	h.notify(l, actorID, "LEAD_PUBLISHED", "Lead published, RFP is out: "+leadName(l),
		eventActorName(l, actorID)+" published this lead and added its tender details. Prebid queries can now be started.",
		l.LeadOwner.ID, managerID(l), approverID(l))
}
