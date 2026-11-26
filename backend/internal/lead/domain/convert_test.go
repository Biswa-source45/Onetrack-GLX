package domain

import "testing"

func TestConvertNext(t *testing.T) {
	owner := Actor{ID: "owner", Roles: []string{"ACCOUNT_MANAGER"}}
	stranger := Actor{ID: "x", Roles: []string{"PRE_SALES"}}
	manager := Actor{ID: "m", Roles: []string{"MANAGER"}}
	lead := func(mod func(*Lead)) *Lead {
		l := &Lead{Stage: StageGo, PublishStatus: StatusPublished, LeadOwner: UserSummary{ID: "owner"}}
		l.Prebid.Stage = PbNotStarted
		if mod != nil {
			mod(l)
		}
		return l
	}

	cases := []struct {
		name  string
		lead  *Lead
		actor Actor
		ok    bool
	}{
		{"owner converts a Go lead", lead(nil), owner, true},
		{"manager converts", lead(nil), manager, true},
		{"unrelated user", lead(nil), stranger, false},
		{"not yet Go", lead(func(l *Lead) { l.Stage = StageApproved }), owner, false},
		{"No-Go", lead(func(l *Lead) { l.Stage = StageNoGo }), manager, false},
		{"prebid still open", lead(func(l *Lead) { l.Prebid.Stage = PbSent }), owner, false},
		{"prebid closed", lead(func(l *Lead) { l.Prebid.Stage = PbClosed }), owner, true},
		{"unpublished", lead(func(l *Lead) { l.PublishStatus = StatusUnpublished }), owner, true},
		{"already converted", lead(func(l *Lead) { l.ConvertedTender = &ConvertedTender{ID: "b"} }), manager, false},
	}
	for _, c := range cases {
		if err := c.lead.ConvertNext(c.actor); (err == nil) != c.ok {
			t.Errorf("%s: err = %v", c.name, err)
		}
	}

	converted := lead(func(l *Lead) { l.ConvertedTender = &ConvertedTender{ID: "b"} })
	if converted.EditableBy(manager) {
		t.Error("a converted lead must be read-only")
	}
	if _, err := converted.PrebidNext(PbStart, owner); err == nil {
		t.Error("prebid cannot start on a converted lead")
	}
}
