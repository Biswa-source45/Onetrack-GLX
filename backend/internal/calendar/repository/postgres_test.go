package repository

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// The eligibility rule mirrors derivedStatusExpr in the bid repository: a tender
// the app counts as submitted or resolved must never reach the deadline engine.
// (No database here, so this guards the query text itself.)
func TestCandidateSelectExcludesSubmittedAndResolvedTenders(t *testing.T) {
	for _, want := range []string{
		"'GEM_SUBMISSION'", "'TECHNICAL_EVALUATION'", "'FINANCIAL_EVALUATION'", "'AWARD_HANDOVER'",
		"'WON'", "'LOST'", "'CANCELLED'",
		"submission_done = false", "submission_status, '') <> 'SUBMITTED'",
		"bid_status = 'ACTIVE'", "archived_at IS NULL", "bid_outcome IS NULL",
	} {
		assert.True(t, strings.Contains(candidateSelect, want), "candidateSelect must contain %s", want)
	}
}

// Coverage must classify tenders with the very same rule the engine selects by,
// so its in_window bucket is always exactly the candidate count.
func TestCoverageUsesTheEngineEligibilityRule(t *testing.T) {
	assert.Contains(t, candidateSelect, eligibleCond)
	assert.Contains(t, coverageSelect, eligibleCond)

	for _, want := range []string{
		"FROM bid.bid_workspaces b",
		"b.bid_status = 'ACTIVE' AND b.archived_at IS NULL",
		"COALESCE(b.closing_date, b.end_date)",
		"COUNT(*) FILTER (WHERE closes IS NULL)",    // no_closing_date
		"COUNT(*) FILTER (WHERE closes <= $1)",      // already_closed
		"closes > $1 AND NOT eligible",              // submitted_or_resolved
		"closes > $2 AND eligible",                  // beyond_window
		"closes > $1 AND closes <= $2 AND eligible", // in_window, same (from, to] bounds as the candidate query
		"COALESCE(", // a NULL column counts as ineligible instead of dropping out of every bucket
	} {
		assert.Contains(t, coverageSelect, want)
	}
}

func TestCandidateSelectJoinsOnlyAnActiveReportingManager(t *testing.T) {
	assert.Contains(t, candidateSelect, "LEFT JOIN auth.users m ON m.id = b.reporting_manager_id AND m.is_active = true")
}
