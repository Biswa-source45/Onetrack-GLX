package domain

import (
	"fmt"
	"time"
)

// EventConverted is the timeline step recorded when a lead becomes a tender.
const EventConverted = "CONVERTED"

// ConvertedTender is the tender a lead was turned into.
type ConvertedTender struct {
	ID string `json:"id"`
	// Ref is what people call the tender: its bid / RFP number, else a short id.
	Ref         string     `json:"ref"`
	ConvertedAt *time.Time `json:"converted_at"`
}

// ConvertNext says whether this actor may turn the lead into a tender now, or
// why not. It needs a Go decision, and a prebid round that was started has to be
// closed first. The lead's own people and Admin/Manager roles may do it (the
// route also requires bid.create).
func (l *Lead) ConvertNext(a Actor) error {
	if l.ConvertedTender != nil {
		return fmt.Errorf("%w: this lead is already converted to a tender", ErrValidation)
	}
	if l.Stage != StageGo {
		return fmt.Errorf("%w: only a lead marked as Go can be converted to a tender", ErrValidation)
	}
	if l.PublishStatus == StatusPublished && l.Prebid.Stage != PbNotStarted && l.Prebid.Stage != PbClosed {
		return fmt.Errorf("%w: close the prebid queries before converting this lead", ErrValidation)
	}
	if l.LeadOwner.ID != a.ID && !l.isReviewer(a) && !l.isApprover(a) && !a.hasAny(ApproverRoles) {
		return fmt.Errorf("%w: only this lead's owner, Reporting Manager, approver or an Admin/Manager can convert it", ErrForbidden)
	}
	return nil
}
