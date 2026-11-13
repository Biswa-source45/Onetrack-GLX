package repository

import (
	"strings"
	"testing"
)

// "My Tenders" must match every way a user can be on a tender, all bound to one placeholder.
func TestMemberCondCoversEveryMembership(t *testing.T) {
	got := memberCond(3)
	for _, want := range []string{"b.bid_owner_id = $3", "b.reporting_manager_id = $3", "b.account_manager_id = $3", "b.presales_id = $3", "bid_workspace_members", "m.user_id = $3"} {
		if !strings.Contains(got, want) {
			t.Errorf("memberCond missing %q in %s", want, got)
		}
	}
}
