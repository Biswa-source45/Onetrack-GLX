// Package roles maps the organisation roles (Managing Director, Reporting
// Manager, ...) onto the legacy role names that the rest of the backend gates
// behaviour on (ADMIN, MANAGER, FINANCE, ...). The auth middleware expands a
// caller's roles through Expand, so every existing role check accepts the new
// roles without being rewritten. Keep in sync with frontend/src/lib/roles.js.
package roles

import "sort"

// actsAs: new role -> legacy roles whose behaviour it carries.
var actsAs = map[string][]string{
	"SOFTWARE_DEVELOPER": {"SUPER_ADMIN"},
	"MANAGING_DIRECTOR":  {"ADMIN"},
	"REPORTING_MANAGER":  {"MANAGER"},
	"BID_MANAGER":        {"MANAGER"},
	"PRESALES_MANAGER":   {"MANAGER", "PRE_SALES"},
	"SALES_MANAGER":      {"ACCOUNT_MANAGER"},
	"ACCOUNTS_MANAGER":   {"ACCOUNT_MANAGER"},
	"FINANCE_MANAGER":    {"FINANCE"},
	"FINANCE_EXECUTIVE":  {"FINANCE"},
	"DELIVERY_MANAGER":   {"MANAGER"},
}

// viewOnly roles see what their legacy role sees but are never offered as an
// approver, assignee or alert recipient. Writes are blocked by their
// permissions (no bid.edit), not here.
var viewOnly = map[string]bool{"DELIVERY_MANAGER": true}

// Expand returns held plus the legacy roles each one acts as, order kept
// (primary role stays first) and duplicates removed.
func Expand(held []string) []string {
	out := make([]string, 0, len(held)+2)
	seen := make(map[string]bool, len(held)+2)
	add := func(r string) {
		if !seen[r] {
			seen[r] = true
			out = append(out, r)
		}
	}
	for _, r := range held {
		add(r)
	}
	for _, r := range held {
		for _, legacy := range actsAs[r] {
			add(legacy)
		}
	}
	return out
}

// Holders returns the given legacy role names plus every non-view-only new role
// that acts as one of them — what to query when "everyone who is a Manager"
// must include Reporting Managers, Bid Managers and so on.
func Holders(legacy ...string) []string {
	out := append([]string(nil), legacy...)
	want := make(map[string]bool, len(legacy))
	for _, l := range legacy {
		want[l] = true
	}
	var extra []string
	for role, as := range actsAs {
		if viewOnly[role] {
			continue
		}
		for _, l := range as {
			if want[l] {
				extra = append(extra, role)
				break
			}
		}
	}
	sort.Strings(extra)
	return append(out, extra...)
}
