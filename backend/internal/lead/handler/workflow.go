package handler

import (
	"context"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/lead/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

func actorOf(c *gin.Context) domain.Actor {
	rolesVal, _ := c.Get("roles")
	roles, _ := rolesVal.([]string)
	return domain.Actor{ID: c.GetString("user_id"), Roles: roles}
}

// forActor fills the per-caller fields of a detail response.
func (h *LeadHandler) forActor(l *domain.Lead, a domain.Actor) {
	l.AllowedActions = l.ActionsFor(a)
	l.CanEdit = l.EditableBy(a)
	l.CanDelete = l.DeletableBy(a)
}

// fail maps the lead module's sentinel errors onto HTTP responses.
func fail(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		response.NotFound(c, "Lead not found")
	case errors.Is(err, domain.ErrForbidden):
		response.Forbidden(c, strings.TrimPrefix(err.Error(), domain.ErrForbidden.Error()+": "))
	case errors.Is(err, domain.ErrValidation):
		response.BadRequest(c, userMessage(err), nil)
	default:
		response.InternalError(c, err.Error())
	}
}

// Update edits a lead's details — same payload and rules as Create.
func (h *LeadHandler) Update(c *gin.Context) {
	ctx, id, actor := c.Request.Context(), c.Param("id"), actorOf(c)
	var req domain.CreateLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid lead payload", nil)
		return
	}
	lead, err := h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	if !lead.EditableBy(actor) {
		response.Forbidden(c, "You cannot edit this lead at its current stage")
		return
	}
	if strings.TrimSpace(req.LeadOwnerID) == "" {
		req.LeadOwnerID = lead.LeadOwner.ID // an edit that doesn't name an owner keeps the current one
	}
	if err := req.Normalize(); err != nil {
		fail(c, err)
		return
	}
	if err := h.repo.Update(ctx, id, &req, actor.ID); err != nil {
		fail(c, err)
		return
	}
	lead, err = h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	h.forActor(lead, actor)
	response.Success(c, http.StatusOK, "Lead updated", lead)
}

// Delete removes a lead for good: the row, its documents and history, the
// alerts pointing at it, and its folder on disk.
func (h *LeadHandler) Delete(c *gin.Context) {
	ctx, id := c.Request.Context(), c.Param("id")
	lead, err := h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	if !lead.DeletableBy(actorOf(c)) {
		response.Forbidden(c, "Only this lead's Reporting Manager or an Admin/Manager can delete it")
		return
	}
	folder, err := h.repo.Delete(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	// Row first, files second — same order as DeleteDocument, for the same
	// reason: a failed disk delete leaves a harmless orphan folder, not a
	// listed lead whose files are gone. folder is server-generated, but it
	// is still checked: an empty value here would remove the whole root.
	if folder != "" && folder == filepath.Base(folder) {
		if err := os.RemoveAll(filepath.Join(h.rootDir, folder)); err != nil {
			log.Printf("[leads] could not remove folder %q of deleted lead %s: %v", folder, id, err)
		}
	}
	response.Success(c, http.StatusOK, "Lead deleted", nil)
}

// Transition takes one workflow step: send for approval, approve, send
// back, Go or No-Go. The rules live in domain.Lead.Next.
func (h *LeadHandler) Transition(c *gin.Context) {
	ctx, id, actor := c.Request.Context(), c.Param("id"), actorOf(c)
	var req domain.TransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request", nil)
		return
	}
	if err := req.Normalize(actor.ID); err != nil {
		fail(c, err)
		return
	}
	lead, err := h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	next, err := lead.Next(req.Action, actor)
	if err != nil {
		fail(c, err)
		return
	}

	var approverID, note *string
	if req.Action == domain.ActionSend {
		ok, err := h.repo.UserHasAnyRole(ctx, req.ApproverID, domain.ApproverRoles)
		if err != nil {
			fail(c, err)
			return
		}
		if !ok {
			response.BadRequest(c, "The approver must be an active Admin or Manager", nil)
			return
		}
		approverID = &req.ApproverID
	}
	if req.Note != "" {
		note = &req.Note
	}
	if err := h.repo.Transition(ctx, id, lead.Stage, next, req.Action, actor.ID, approverID, note); err != nil {
		fail(c, err)
		return
	}

	lead, err = h.repo.Get(ctx, id)
	if err != nil {
		fail(c, err)
		return
	}
	h.notifyTransition(lead, req.Action, actor.ID, req.Note)
	h.forActor(lead, actor)
	response.Success(c, http.StatusOK, "Lead updated", lead)
}

// ── Notifications ───────────────────────────────────────────────────────────
// One in-app alert + email per recipient (alertSvc does both), each linking
// straight to the lead. Best-effort: a failed alert never fails the step.

func leadName(l *domain.Lead) string {
	if l.Title != nil && *l.Title != "" {
		return *l.Title
	}
	return l.AccountName
}

// detailsHTML is the lead summary every notification carries, so the
// recipient can judge it from the email without opening the app.
func detailsHTML(l *domain.Lead) string {
	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	value := ""
	if l.EstimatedValue != nil {
		value = fmt.Sprintf("₹ %.2f", *l.EstimatedValue)
	}
	manager := ""
	if l.ReportingManager != nil {
		manager = l.ReportingManager.FullName
	}
	kind := "Private"
	if l.LeadType == "GOV" {
		kind = "Government"
	}
	rows := [][2]string{
		{"Account", l.AccountName},
		{"Tender Title", str(l.Title)},
		{"Type", kind + ", " + strings.ToLower(l.PublishStatus)},
		{"Department", str(l.DepartmentName)},
		{"Location", str(l.Location)},
		{"Category", str(l.Category)},
		{"Estimated Value", value},
		{"Expected Date", str(l.ExpectedDate)},
		{"Scope", str(l.HighLevelScope)},
		{"Lead Owner", l.LeadOwner.FullName},
		{"Reporting Manager", manager},
	}
	var b strings.Builder
	b.WriteString(`<table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:12px;">`)
	for _, r := range rows {
		if r[1] == "" {
			continue
		}
		fmt.Fprintf(&b, `<tr><td style="padding:6px 10px;border:1px solid #e2e8f0;color:#64748b;white-space:nowrap;">%s</td><td style="padding:6px 10px;border:1px solid #e2e8f0;color:#1e293b;">%s</td></tr>`,
			r[0], html.EscapeString(r[1]))
	}
	b.WriteString(`</table>`)
	return b.String()
}

// notify sends one alert to each distinct recipient, skipping the person
// who just acted (they don't need telling) and empty ids.
func (h *LeadHandler) notify(l *domain.Lead, actorID, alertType, title, lead string, recipients ...string) {
	if h.alerts == nil {
		return
	}
	message := "<p>" + lead + "</p>" + detailsHTML(l)
	seen := map[string]bool{actorID: true, "": true}
	for _, id := range recipients {
		if seen[id] {
			continue
		}
		seen[id] = true
		to := id
		actor := actorID
		_ = h.alerts.CreateAlert(context.Background(), &alertDomain.Alert{
			UserID: &to, CreatedBy: &actor, Type: alertType,
			Title: title, Message: message, Link: "/dashboard/leads/" + l.ID,
		})
	}
}

func managerID(l *domain.Lead) string {
	if l.ReportingManager != nil {
		return l.ReportingManager.ID
	}
	return ""
}

func approverID(l *domain.Lead) string {
	if l.Approver != nil {
		return l.Approver.ID
	}
	return ""
}

func (h *LeadHandler) notifyCreated(l *domain.Lead, actorID string) {
	h.notify(l, actorID, "LEAD_REVIEW_REQUIRED",
		"New lead awaiting your review: "+leadName(l),
		fmt.Sprintf("%s added a new lead and named you its Reporting Manager. Review it and send it for approval.",
			html.EscapeString(l.CreatedBy.FullName)),
		managerID(l))
}

func (h *LeadHandler) notifyTransition(l *domain.Lead, action, actorID, note string) {
	actorName := "Someone"
	for i := len(l.Events) - 1; i >= 0; i-- {
		if l.Events[i].Actor.ID == actorID {
			actorName = l.Events[i].Actor.FullName
			break
		}
	}
	actorName = html.EscapeString(actorName)
	name := leadName(l)
	withNote := func(label, text string) string {
		if note == "" {
			return text
		}
		return text + fmt.Sprintf(`</p><p style="margin-top:12px;padding:10px 14px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;color:#78350f;"><strong>%s:</strong> %s`,
			label, html.EscapeString(note))
	}

	switch action {
	case domain.ActionSend:
		h.notify(l, actorID, "LEAD_APPROVAL_REQUIRED", "Lead awaiting your approval: "+name,
			withNote("Remarks", actorName+" reviewed this lead and sent it to you for approval."),
			approverID(l))
	case domain.ActionApprove:
		h.notify(l, actorID, "LEAD_APPROVED", "Lead approved: "+name,
			withNote("Comment", actorName+" approved this lead. It is back with the Reporting Manager for the Go / No-Go decision."),
			managerID(l), l.LeadOwner.ID)
	case domain.ActionSendBack:
		h.notify(l, actorID, "LEAD_SENT_BACK", "Lead sent back for changes: "+name,
			withNote("What needs to change", actorName+" did not approve this lead yet and sent it back."),
			managerID(l), l.LeadOwner.ID)
	case domain.ActionGo:
		h.notify(l, actorID, "LEAD_GO", "Lead is a Go: "+name,
			withNote("Note", actorName+" decided to go ahead with this lead."),
			l.LeadOwner.ID, approverID(l), managerID(l))
	case domain.ActionNoGo:
		h.notify(l, actorID, "LEAD_NO_GO", "Lead cancelled (No-Go): "+name,
			withNote("Reason", actorName+" decided not to pursue this lead."),
			l.LeadOwner.ID, approverID(l), managerID(l))
	}
}
