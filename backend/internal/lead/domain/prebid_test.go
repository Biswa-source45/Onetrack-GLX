package domain

import (
	"errors"
	"reflect"
	"testing"
)

func TestPrebidFlow(t *testing.T) {
	am := Actor{ID: "am", Roles: []string{"ACCOUNT_MANAGER"}}
	pm := Actor{ID: "pm", Roles: []string{"PRE_SALES"}}
	dm := Actor{ID: "dm", Roles: []string{"DELIVERY_MANAGER"}}
	bm := Actor{ID: "bm", Roles: []string{"BID_MANAGER"}}
	admin := Actor{ID: "adm", Roles: []string{"ADMIN"}}

	l := &Lead{PublishStatus: StatusPublished, Stage: StageRMReview, LeadOwner: UserSummary{ID: "am"}, Prebid: PrebidState{Stage: PbNotStarted}}

	// The whole round, one actor per step; the AM is the hub.
	steps := []struct {
		action   string
		actor    Actor
		assignee string
		want     string
	}{
		{PbStart, am, "pm", PbWithPM},
		{PbReturn, pm, "", PbWithAM},
		{PbSendDM, am, "dm", PbWithDM},
		{PbReturn, dm, "", PbWithAM},
		{PbSendBM, am, "bm", PbWithBM},
		{PbReturn, bm, "", PbWithAM},
		{PbSendPM, am, "pm", PbWithPM}, // any order, more than once
		{PbReturn, pm, "", PbWithAM},
		{PbMarkSent, am, "", PbSent},
		{PbClose, am, "", PbClosed},
	}
	for _, s := range steps {
		next, err := l.PrebidNext(s.action, s.actor)
		if err != nil || next != s.want {
			t.Fatalf("%s from %s: got %q, %v; want %q", s.action, l.Prebid.Stage, next, err, s.want)
		}
		l.Prebid.Stage = next
		if s.assignee != "" {
			l.Prebid.Assignee = &UserSummary{ID: s.assignee}
		}
	}
	if got := l.PrebidActionsFor(admin); len(got) != 0 {
		t.Fatalf("a closed sheet allows nothing, got %v", got)
	}
}

func TestPrebidWhoMayDoWhat(t *testing.T) {
	am := Actor{ID: "am", Roles: []string{"ACCOUNT_MANAGER"}}
	pm := Actor{ID: "pm", Roles: []string{"PRE_SALES"}}
	dm := Actor{ID: "dm", Roles: []string{"DELIVERY_MANAGER"}}
	other := Actor{ID: "x", Roles: []string{"BID_MANAGER"}}
	admin := Actor{ID: "adm", Roles: []string{"ADMIN"}}
	newLead := func(stage, assignee string) *Lead {
		l := &Lead{PublishStatus: StatusPublished, Stage: StageRMReview, LeadOwner: UserSummary{ID: "am"}, Prebid: PrebidState{Stage: stage}}
		if assignee != "" {
			l.Prebid.Assignee = &UserSummary{ID: assignee}
		}
		return l
	}

	// Editable cells per stage and person.
	cases := []struct {
		name  string
		lead  *Lead
		actor Actor
		want  []string
	}{
		{"PM edits product map", newLead(PbWithPM, "pm"), pm, []string{"product", "oem", "pm_remarks"}},
		{"AM locked out while with PM", newLead(PbWithPM, "pm"), am, []string{}},
		{"DM comments only", newLead(PbWithDM, "dm"), dm, []string{"dm_comment"}},
		{"DM cannot touch the query column", newLead(PbWithAM, "dm"), dm, []string{}},
		{"someone else is locked out", newLead(PbWithDM, "dm"), other, []string{}},
		{"BM comments only", newLead(PbWithBM, "x"), other, []string{"bm_comment"}},
		{"AM compiles the queries", newLead(PbWithAM, "dm"), am, []string{"product", "oem", "pm_remarks", "clause_ref", "query"}},
		{"AM records the answers once sent", newLead(PbSent, "dm"), am, []string{"customer_response"}},
		{"admin steps in for the holder", newLead(PbWithDM, "dm"), admin, []string{"dm_comment"}},
		{"nothing before it starts", newLead(PbNotStarted, ""), am, []string{}},
		{"nothing once closed", newLead(PbClosed, "pm"), am, []string{}},
	}
	for _, c := range cases {
		if got := c.lead.PrebidEditableFields(c.actor); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: editable = %v, want %v", c.name, got, c.want)
		}
	}

	// Rows may be added or deleted only by whoever can edit the product column.
	if !newLead(PbWithPM, "pm").CanChangePrebidRows(pm) || !newLead(PbWithAM, "").CanChangePrebidRows(am) {
		t.Error("PM (own turn) and AM (own turn) must be able to add rows")
	}
	if newLead(PbWithDM, "dm").CanChangePrebidRows(dm) {
		t.Error("the Delivery Manager must not add rows")
	}

	// Wrong person, right stage -> forbidden. Right person, wrong stage -> validation.
	if _, err := newLead(PbWithAM, "").PrebidNext(PbSendDM, pm); !errors.Is(err, ErrForbidden) {
		t.Errorf("only the AM hands the sheet on, got %v", err)
	}
	if _, err := newLead(PbWithDM, "dm").PrebidNext(PbReturn, other); !errors.Is(err, ErrForbidden) {
		t.Errorf("only the holder returns it, got %v", err)
	}
	if _, err := newLead(PbWithPM, "pm").PrebidNext(PbMarkSent, am); !errors.Is(err, ErrValidation) {
		t.Errorf("cannot mark sent while with the PM, got %v", err)
	}
	if _, err := newLead(PbNotStarted, "").PrebidNext("NOPE", am); !errors.Is(err, ErrValidation) {
		t.Errorf("unknown action must be rejected, got %v", err)
	}

	// Only published leads (they carry an RFP), and not once cancelled.
	draft := newLead(PbNotStarted, "")
	draft.PublishStatus = StatusUnpublished
	if _, err := draft.PrebidNext(PbStart, am); !errors.Is(err, ErrValidation) {
		t.Errorf("an unpublished lead has no prebid, got %v", err)
	}
	cancelled := newLead(PbWithAM, "")
	cancelled.Stage = StageNoGo
	if got := cancelled.PrebidActionsFor(am); len(got) != 0 || len(cancelled.PrebidEditableFields(am)) != 0 {
		t.Errorf("a No-Go lead is frozen, got actions %v", got)
	}
}

func TestPrebidInputs(t *testing.T) {
	l := &Lead{Prebid: PrebidState{Items: []PrebidItem{{Query: "  "}, {Product: "Laptop"}}}}
	if err := l.PrebidReadyToSend(); !errors.Is(err, ErrValidation) {
		t.Errorf("a sheet with no query cannot go to the customer, got %v", err)
	}
	l.Prebid.Items[1].Query = "Is a laptop with 16 GB acceptable?"
	if err := l.PrebidReadyToSend(); err != nil {
		t.Errorf("one query is enough, got %v", err)
	}

	r := PrebidTransitionRequest{Action: " prebid_send_dm "}
	if err := r.Normalize(); !errors.Is(err, ErrValidation) {
		t.Errorf("handing over needs a person, got %v", err)
	}
	r = PrebidTransitionRequest{Action: PbReturn, AssigneeID: "stray"}
	if err := r.Normalize(); err != nil || r.AssigneeID != "" {
		t.Errorf("a return takes no assignee, got %v / %q", err, r.AssigneeID)
	}

	if _, err := NormalizePrebidEdit(map[string]string{"id": "x"}); !errors.Is(err, ErrValidation) {
		t.Errorf("unknown columns must be rejected, got %v", err)
	}
	if got, err := NormalizePrebidEdit(map[string]string{"query": "  hello "}); err != nil || got["query"] != "hello" {
		t.Errorf("edits are trimmed, got %v, %v", got, err)
	}
}
