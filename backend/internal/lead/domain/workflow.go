package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// ErrForbidden: the actor is not the person this step belongs to.
var ErrForbidden = errors.New("forbidden")

// Lead workflow stages — see migration 000053.
const (
	StageRMReview        = "RM_REVIEW"
	StagePendingApproval = "PENDING_APPROVAL"
	StageApproved        = "APPROVED"
	StageGo              = "GO"
	StageNoGo            = "NO_GO"
)

// Workflow actions. Each is also the event_type recorded for it.
const (
	ActionSend     = "SENT_FOR_APPROVAL"
	ActionApprove  = "APPROVED"
	ActionSendBack = "SENT_BACK"
	ActionGo       = "GO"
	ActionNoGo     = "NO_GO"

	EventEdited = "EDITED"
)

// ApproverRoles may be chosen as a lead's approver. AdminRoles may also
// step in for an absent Reporting Manager or approver.
var (
	ApproverRoles = []string{"SUPER_ADMIN", "ADMIN", "MANAGER"}
	AdminRoles    = []string{"SUPER_ADMIN", "ADMIN"}
)

// Actor is whoever is attempting a step.
type Actor struct {
	ID    string
	Roles []string
}

func (a Actor) hasAny(roles []string) bool {
	for _, r := range a.Roles {
		for _, want := range roles {
			if r == want {
				return true
			}
		}
	}
	return false
}

// Event is one row of a lead's timeline.
type Event struct {
	ID        string      `json:"id"`
	Actor     UserSummary `json:"actor"`
	EventType string      `json:"event_type"`
	Note      *string     `json:"note"`
	CreatedAt time.Time   `json:"created_at"`
}

// isReviewer: the lead's Reporting Manager, or an Admin stepping in. A lead
// with no Reporting Manager would otherwise be stuck, so any approver-role
// holder may review it.
func (l *Lead) isReviewer(a Actor) bool {
	if l.ReportingManager != nil {
		return l.ReportingManager.ID == a.ID || a.hasAny(AdminRoles)
	}
	return a.hasAny(ApproverRoles)
}

func (l *Lead) isApprover(a Actor) bool {
	return (l.Approver != nil && l.Approver.ID == a.ID) || a.hasAny(AdminRoles)
}

// Next returns the stage action moves the lead to, or why this actor can't
// take it right now. It is the single statement of the workflow's rules:
// ActionsFor (what the page offers) is derived from it.
func (l *Lead) Next(action string, a Actor) (string, error) {
	type rule struct {
		from     []string
		to       string
		reviewer bool // true: the Reporting Manager's step; false: the approver's
	}
	rules := map[string]rule{
		ActionSend:     {[]string{StageRMReview}, StagePendingApproval, true},
		ActionApprove:  {[]string{StagePendingApproval}, StageApproved, false},
		ActionSendBack: {[]string{StagePendingApproval}, StageRMReview, false},
		ActionGo:       {[]string{StageApproved}, StageGo, true},
		ActionNoGo:     {[]string{StageRMReview, StagePendingApproval, StageApproved}, StageNoGo, true},
	}
	r, ok := rules[action]
	if !ok {
		return "", fmt.Errorf("%w: unknown action", ErrValidation)
	}
	inStage := false
	for _, s := range r.from {
		inStage = inStage || s == l.Stage
	}
	if !inStage {
		return "", fmt.Errorf("%w: this lead is no longer at a stage where that is possible — reload the page", ErrValidation)
	}
	if r.reviewer && !l.isReviewer(a) {
		return "", fmt.Errorf("%w: only this lead's Reporting Manager (or an Admin) can do that", ErrForbidden)
	}
	if !r.reviewer && !l.isApprover(a) {
		return "", fmt.Errorf("%w: only the approver this lead was sent to (or an Admin) can do that", ErrForbidden)
	}
	return r.to, nil
}

// ActionsFor lists what this actor can do to the lead right now.
func (l *Lead) ActionsFor(a Actor) []string {
	allowed := []string{}
	for _, action := range []string{ActionSend, ActionApprove, ActionSendBack, ActionGo, ActionNoGo} {
		if _, err := l.Next(action, a); err == nil {
			allowed = append(allowed, action)
		}
	}
	return allowed
}

// EditableBy: the Reporting Manager, the approver, and Admin/Manager roles —
// until the lead is cancelled. The lead's owner can also correct their own
// lead, but only while it is still with the Reporting Manager: once it has
// gone for approval, what the approver is judging must not shift under them.
func (l *Lead) EditableBy(a Actor) bool {
	if l.Stage == StageNoGo {
		return false
	}
	if l.Stage == StageRMReview && l.LeadOwner.ID == a.ID {
		return true
	}
	return l.isReviewer(a) || l.isApprover(a) || a.hasAny(ApproverRoles)
}

// DeletableBy: the Reporting Manager and Admin/Manager roles, at any stage.
// Deleting removes the lead, its documents and its history for good.
func (l *Lead) DeletableBy(a Actor) bool {
	return l.isReviewer(a) || a.hasAny(ApproverRoles)
}

// TransitionRequest is the body of POST /leads/:id/transition.
type TransitionRequest struct {
	Action     string `json:"action"`
	ApproverID string `json:"approver_id"` // ActionSend only
	Note       string `json:"note"`
}

// Normalize enforces what each action needs beyond the stage/actor rules.
func (r *TransitionRequest) Normalize(actorID string) error {
	r.Action = strings.ToUpper(strings.TrimSpace(r.Action))
	r.ApproverID = strings.TrimSpace(r.ApproverID)
	r.Note = strings.TrimSpace(r.Note)
	switch r.Action {
	case ActionSend:
		if r.ApproverID == "" {
			return fmt.Errorf("%w: choose who should approve this lead", ErrValidation)
		}
		if r.ApproverID == actorID {
			return fmt.Errorf("%w: you cannot send a lead to yourself for approval", ErrValidation)
		}
	case ActionSendBack:
		if r.Note == "" {
			return fmt.Errorf("%w: say what needs to change before sending it back", ErrValidation)
		}
	case ActionNoGo:
		if r.Note == "" {
			return fmt.Errorf("%w: a reason is required for No-Go", ErrValidation)
		}
	}
	if r.Action != ActionSend {
		r.ApproverID = ""
	}
	return nil
}
