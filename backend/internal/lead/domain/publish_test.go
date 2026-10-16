package domain

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestPublishNext(t *testing.T) {
	owner := Actor{ID: "owner", Roles: []string{"ACCOUNT_MANAGER"}}
	rm := Actor{ID: "rm", Roles: []string{"BID_EXECUTIVE"}}
	stranger := Actor{ID: "x", Roles: []string{"BID_EXECUTIVE"}}
	admin := Actor{ID: "adm", Roles: []string{"ADMIN"}}
	lead := func(status, stage string) *Lead {
		return &Lead{PublishStatus: status, Stage: stage, LeadOwner: UserSummary{ID: "owner"}, ReportingManager: &UserSummary{ID: "rm"}}
	}

	// Whoever may edit the lead may publish it.
	for _, a := range []Actor{owner, rm, admin} {
		if err := lead(StatusUnpublished, StageRMReview).PublishNext(a); err != nil {
			t.Errorf("%s should be able to publish at RM review, got %v", a.ID, err)
		}
	}
	if err := lead(StatusUnpublished, StageRMReview).PublishNext(stranger); !errors.Is(err, ErrForbidden) {
		t.Errorf("a stranger must not publish, got %v", err)
	}
	// Once it is with the approver the owner can no longer shift it (same rule as editing).
	if err := lead(StatusUnpublished, StagePendingApproval).PublishNext(owner); !errors.Is(err, ErrForbidden) {
		t.Errorf("the owner cannot publish while it is pending approval, got %v", err)
	}
	if err := lead(StatusUnpublished, StageGo).PublishNext(rm); err != nil {
		t.Errorf("an approved/Go lead can still be published when the RFP comes out, got %v", err)
	}
	// One way only, and never once cancelled.
	if err := lead(StatusPublished, StageRMReview).PublishNext(admin); !errors.Is(err, ErrValidation) {
		t.Errorf("a published lead cannot be published again, got %v", err)
	}
	if err := lead(StatusUnpublished, StageNoGo).PublishNext(admin); !errors.Is(err, ErrValidation) {
		t.Errorf("a No-Go lead cannot be published, got %v", err)
	}
}

func TestPublishRequestNormalize(t *testing.T) {
	strp := func(s string) *string { return &s }
	r := PublishRequest{Title: strp("  Supply of Laptops  "), PublishedDetails: json.RawMessage(`{"gem_bid_no":"X"}`)}
	if err := r.Normalize(); err != nil || *r.Title != "Supply of Laptops" {
		t.Fatalf("title is trimmed, got %v / %v", r.Title, err)
	}
	for name, in := range map[string]PublishRequest{
		"no title":           {},
		"blank title":        {Title: strp("   ")},
		"details not object": {Title: strp("t"), PublishedDetails: json.RawMessage(`[1]`)},
		"details not json":   {Title: strp("t"), PublishedDetails: json.RawMessage(`{`)},
	} {
		if err := in.Normalize(); !errors.Is(err, ErrValidation) {
			t.Errorf("%s must be rejected, got %v", name, err)
		}
	}
	empty := PublishRequest{Title: strp("t"), PublishedDetails: json.RawMessage(`null`)}
	if err := empty.Normalize(); err != nil || empty.PublishedDetails != nil {
		t.Errorf("null details are stored as nothing, got %v / %v", empty.PublishedDetails, err)
	}
}
