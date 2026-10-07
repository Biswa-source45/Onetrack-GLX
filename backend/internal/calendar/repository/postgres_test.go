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
