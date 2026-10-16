package domain

import (
	"encoding/json"
	"fmt"
	"strings"
)

// EventPublished is the timeline step recorded when an unpublished lead gets its RFP.
const EventPublished = "PUBLISHED"

// PublishRequest is the body of POST /leads/:id/publish: the tender details an
// unpublished lead gains when its RFP comes out. It carries exactly the published-only
// part of CreateLeadRequest, and is checked by the same rules.
type PublishRequest struct {
	Title            *string         `json:"title"`
	PublishedDetails json.RawMessage `json:"published_details"`
}

func (r *PublishRequest) Normalize() error {
	if r.Title != nil {
		if v := strings.TrimSpace(*r.Title); v == "" {
			r.Title = nil
		} else {
			r.Title = &v
		}
	}
	return checkPublished(r.Title, &r.PublishedDetails)
}

// checkPublished is the rule for a published lead's own fields, shared by create,
// edit and publish: a tender title, and published details that are a JSON object
// (or absent, which is stored as null).
func checkPublished(title *string, details *json.RawMessage) error {
	if title == nil {
		return fmt.Errorf("%w: tender title is required for a published lead", ErrValidation)
	}
	if len(*details) > 0 && string(*details) != "null" {
		var obj map[string]any
		if err := json.Unmarshal(*details, &obj); err != nil {
			return fmt.Errorf("%w: published details must be a JSON object", ErrValidation)
		}
	} else {
		*details = nil
	}
	return nil
}

// PublishNext says whether this actor may publish the lead right now, or why not.
// Publishing is one-way: an unpublished lead becomes published, never the reverse
// (un-publishing would throw away the tender details). Whoever can edit the lead
// can publish it, so the approval-stage rules on editing apply unchanged.
func (l *Lead) PublishNext(a Actor) error {
	if l.PublishStatus != StatusUnpublished {
		return fmt.Errorf("%w: this lead is already published", ErrValidation)
	}
	if l.Stage == StageNoGo {
		return fmt.Errorf("%w: this lead was cancelled (No-Go)", ErrValidation)
	}
	if !l.EditableBy(a) {
		return fmt.Errorf("%w: you cannot publish this lead at its current stage", ErrForbidden)
	}
	return nil
}
