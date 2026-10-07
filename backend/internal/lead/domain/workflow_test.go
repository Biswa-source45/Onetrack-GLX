package domain

import (
	"errors"
	"reflect"
	"testing"
)

func TestLeadWorkflow(t *testing.T) {
	rm := Actor{ID: "rm", Roles: []string{"BID_EXECUTIVE"}}
	approver := Actor{ID: "mg", Roles: []string{"MANAGER"}}
	otherManager := Actor{ID: "mg2", Roles: []string{"MANAGER"}}
	owner := Actor{ID: "owner", Roles: []string{"BID_EXECUTIVE"}}
	admin := Actor{ID: "adm", Roles: []string{"ADMIN"}}

	lead := &Lead{Stage: StageRMReview, ReportingManager: &UserSummary{ID: "rm"}}

	// The full happy path, one actor per step.
	steps := []struct {
		action string
		actor  Actor
		want   string
	}{
		{ActionSend, rm, StagePendingApproval},
		{ActionSendBack, approver, StageRMReview},
		{ActionSend, rm, StagePendingApproval},
		{ActionApprove, approver, StageApproved},
		{ActionGo, rm, StageGo},
	}
	for _, s := range steps {
		next, err := lead.Next(s.action, s.actor)
		if err != nil || next != s.want {
			t.Fatalf("%s from %s: got %q, %v; want %q", s.action, lead.Stage, next, err, s.want)
		}
		lead.Stage = next
		if s.action == ActionSend {
			lead.Approver = &UserSummary{ID: "mg"}
		}
	}

	// Nothing is possible once the lead is decided.
	if got := lead.ActionsFor(admin); len(got) != 0 {
		t.Fatalf("GO lead should allow nothing, got %v", got)
	}

	// Wrong person, right stage -> forbidden. Right person, wrong stage -> validation.
	lead.Stage = StagePendingApproval
	for _, a := range []Actor{owner, rm, otherManager} {
		if _, err := lead.Next(ActionApprove, a); !errors.Is(err, ErrForbidden) {
			t.Fatalf("%s must not approve, got %v", a.ID, err)
		}
	}
	if _, err := lead.Next(ActionGo, rm); !errors.Is(err, ErrValidation) {
		t.Fatalf("Go before approval must be rejected, got %v", err)
	}
	if _, err := lead.Next(ActionSend, owner); !errors.Is(err, ErrValidation) {
		t.Fatalf("stage is checked before the actor, got %v", err)
	}

	// What each person is offered while approval is pending.
	for _, c := range []struct {
		actor Actor
		want  []string
	}{
		{approver, []string{ActionApprove, ActionSendBack}},
		{rm, []string{ActionNoGo}},
		{owner, []string{}},
		{admin, []string{ActionApprove, ActionSendBack, ActionNoGo}},
	} {
		if got := lead.ActionsFor(c.actor); !reflect.DeepEqual(got, c.want) {
			t.Fatalf("%s: allowed %v, want %v", c.actor.ID, got, c.want)
		}
	}

	// No Reporting Manager: an approver-role holder reviews, an executive can't.
	orphan := &Lead{Stage: StageRMReview}
	if _, err := orphan.Next(ActionSend, otherManager); err != nil {
		t.Fatalf("manager should review a lead with no RM: %v", err)
	}
	if _, err := orphan.Next(ActionSend, owner); !errors.Is(err, ErrForbidden) {
		t.Fatalf("executive must not review a lead with no RM, got %v", err)
	}

	// Editing: RM, approver, manager roles; never after No-Go. The owner only
	// while the lead is still with the Reporting Manager.
	lead.LeadOwner = UserSummary{ID: "owner"}
	if !lead.EditableBy(rm) || !lead.EditableBy(approver) || !lead.EditableBy(otherManager) || lead.EditableBy(owner) {
		t.Fatal("edit rights are wrong while approval is pending")
	}
	lead.Stage = StageRMReview
	if !lead.EditableBy(owner) {
		t.Fatal("the owner should be able to edit before the lead is sent for approval")
	}

	// Deleting: RM and Admin/Manager roles, never the plain owner.
	if !lead.DeletableBy(rm) || !lead.DeletableBy(admin) || !lead.DeletableBy(otherManager) || lead.DeletableBy(owner) {
		t.Fatal("delete rights are wrong")
	}
	lead.Stage = StageNoGo
	if lead.EditableBy(admin) {
		t.Fatal("a cancelled lead must not be editable")
	}
}

func TestTransitionRequestNormalize(t *testing.T) {
	bad := []TransitionRequest{
		{Action: "sent_for_approval"},          // no approver
		{Action: ActionSend, ApproverID: "me"}, // self
		{Action: ActionSendBack, Note: "  "},   // no comment
		{Action: ActionNoGo},                   // no reason
	}
	for _, r := range bad {
		if err := r.Normalize("me"); !errors.Is(err, ErrValidation) {
			t.Fatalf("%+v should be rejected, got %v", r, err)
		}
	}
	ok := TransitionRequest{Action: " approved ", ApproverID: "x", Note: " fine "}
	if err := ok.Normalize("me"); err != nil || ok.Action != ActionApprove || ok.ApproverID != "" || ok.Note != "fine" {
		t.Fatalf("normalize: %+v, %v", ok, err)
	}
}
