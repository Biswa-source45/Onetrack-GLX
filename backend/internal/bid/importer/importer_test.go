package importer

import (
	"testing"
	"time"

	"github.com/onetrack/backend/internal/bid/domain"
)

const (
	gbxFixture       = "testdata/gbx_tracker.xlsx"
	dashboardFixture = "testdata/tender_dashboard.xlsx"
)

// findRow returns the parsed bid for a given source row number, failing the
// test if it is not present.
func findRow(t *testing.T, bids []*ImportedBid, rowNum int) *ImportedBid {
	t.Helper()
	for _, b := range bids {
		if b.RowNum == rowNum {
			return b
		}
	}
	t.Fatalf("row %d not found in parsed bids", rowNum)
	return nil
}

func f64(f *float64) float64 {
	if f == nil {
		return -1
	}
	return *f
}

// TestGBXDuplicateRowsAreSkippedNotSummed is the regression test for the bug
// where a repeated tender id had its money summed into the first occurrence
// (B1). Rows 10/11 share GEM/2025/B/6916553; rows 12/13 share
// GEM/2025/B/7016627. Both money and quantity must come only from the first
// occurrence, and the later rows must be skipped, not merged.
func TestGBXDuplicateRowsAreSkippedNotSummed(t *testing.T) {
	p, err := ParseWorkbook(gbxFixture)
	if err != nil {
		t.Fatalf("ParseWorkbook: %v", err)
	}
	if err := MarkDuplicates(nil, nil, p); err != nil {
		t.Fatalf("MarkDuplicates: %v", err)
	}

	row10 := findRow(t, p.Bids, 10)
	row11 := findRow(t, p.Bids, 11)
	if row10.Skip {
		t.Fatalf("row 10 (first occurrence) should not be skipped")
	}
	if !row11.Skip {
		t.Fatalf("row 11 (duplicate id) should be skipped, not merged")
	}
	if got, want := f64(row10.EMDAmount), 100000.0; got != want {
		t.Errorf("row 10 EMD = %.2f, want %.2f (must not be summed with row 11)", got, want)
	}
	if got, want := f64(row10.EstimatedValue), 43239315.84; got != want {
		t.Errorf("row 10 estimated value = %.2f, want %.2f (must not be summed with row 11)", got, want)
	}

	row12 := findRow(t, p.Bids, 12)
	row13 := findRow(t, p.Bids, 13)
	if row12.Skip {
		t.Fatalf("row 12 (first occurrence) should not be skipped")
	}
	if !row13.Skip {
		t.Fatalf("row 13 (duplicate id) should be skipped, not merged")
	}
	if got, want := f64(row12.QuotedPrice), 178724.0; got != want {
		t.Errorf("row 12 quoted price = %.2f, want %.2f (must not be summed with row 13)", got, want)
	}
}

// TestGBXInconclusiveOutcomeIsClosedNotLost is the regression test for the
// fallback branch of deriveStage fabricating a Lost outcome whenever the
// status columns are merely inconclusive (B3/general "don't guess a loss"
// decision).
func TestGBXInconclusiveOutcomeIsClosedNotLost(t *testing.T) {
	b := ParseRow(1, []string{
		"", "", "GEM/2099/B/TEST0001", "", "Some Client", "Some Scope", "", "", "", // colCategory..colActivityType
		"Jan-2099", "45000", "45010", "", "No", "", // colReportingMonth..colBG
		"Closed", "Submitted", "Not Submitted", "Not Submitted", "Not Submitted", // colBidStatus..colPOStatus
		"", "", "", "", "", // colBidValue..colRemark
	})
	if b.BidStatus != domain.BidStatusClosed {
		t.Errorf("bid_status = %q, want %q for an inconclusive closed row", b.BidStatus, domain.BidStatusClosed)
	}
	if b.BidOutcome != nil {
		t.Errorf("bid_outcome = %q, want nil - outcome was never actually recorded", *b.BidOutcome)
	}
}

// TestDashboardDeterministicAcrossRuns is the regression test for the derived
// stage depending on time.Now() (B2). Parsing the same row twice with the
// same pinned `now` must produce byte-identical derivation, and the case
// tested here (deadline already passed, status blank) exercises the branch
// that used to read the wall clock.
func TestDashboardDeterministicAcrossRuns(t *testing.T) {
	row := []string{
		"1", "GEM/2099/B/TEST0002", "GeM Link", "Bid", "1-Jan-2020", "0.5",
		"Someone", "A Client", "A Product", "1", "NA", "NA", "NA", "NA", "NA", "",
		"", "", "", "", "", "", "", "", "", "", "", "",
	}
	fixedNow := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	first := ParseRowDashboard(2, row, fixedNow)
	second := ParseRowDashboard(2, row, fixedNow)

	if first.WorkflowStage != second.WorkflowStage || first.BidStatus != second.BidStatus {
		t.Fatalf("same row + same now produced different derivation: (%s,%s) vs (%s,%s)",
			first.WorkflowStage, first.BidStatus, second.WorkflowStage, second.BidStatus)
	}
	// The deadline (2020) is long before fixedNow (2026), so this must resolve
	// to Closed with no outcome, not Active - and must not depend on whatever
	// the wall clock happens to read when the test runs.
	if first.BidStatus != domain.BidStatusClosed {
		t.Errorf("bid_status = %q, want %q (deadline has passed relative to the pinned now)", first.BidStatus, domain.BidStatusClosed)
	}
	if first.BidOutcome != nil {
		t.Errorf("bid_outcome = %q, want nil - status was blank, nothing was actually recorded", *first.BidOutcome)
	}
}

// TestDashboardUnrecordedResultsAreClosedNotLost covers the "Participated"
// and unmatched-free-text branches that used to fabricate a Lost outcome
// (B3), using the real Tender_Dashboard_26-27.xlsx data (row 3: GLOBX
// participated, no final result ever recorded).
func TestDashboardUnrecordedResultsAreClosedNotLost(t *testing.T) {
	p, err := ParseWorkbookDashboard(dashboardFixture)
	if err != nil {
		t.Fatalf("ParseWorkbookDashboard: %v", err)
	}
	row3 := findRow(t, p.Bids, 3)
	if row3.BidStatus != domain.BidStatusClosed {
		t.Errorf("row 3 bid_status = %q, want %q (participated, no result recorded)", row3.BidStatus, domain.BidStatusClosed)
	}
	if row3.BidOutcome != nil {
		t.Errorf("row 3 bid_outcome = %q, want nil", *row3.BidOutcome)
	}
}

// TestParseTimeFractionRoundsToNearestSecond is the regression test for B9:
// truncating the day-fraction lost a second on times whose float64
// representation was not exact (e.g. 13:00 stored as 0.5416666666666666).
func TestParseTimeFractionRoundsToNearestSecond(t *testing.T) {
	frac, ok := parseTimeFraction("0.5416666666666666") // intended: 13:00:00
	if !ok {
		t.Fatalf("expected a valid time fraction")
	}
	got := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC).Add(timeOfDay(frac))
	if got.Hour() != 13 || got.Minute() != 0 || got.Second() != 0 {
		t.Errorf("13:00 fraction rounded to %02d:%02d:%02d, want 13:00:00", got.Hour(), got.Minute(), got.Second())
	}
}

// TestExemptedRowsCarryAnExemptionType is the regression test for B4: a row
// imported with emd_exempted=true and no exemption type fails
// validateEMDExemption on every later PATCH, freezing the tender. Both
// formats must populate a type (and reason) whenever they set the exempted
// flag, so the inserted record is valid from the moment it exists.
func TestExemptedRowsCarryAnExemptionType(t *testing.T) {
	gbxExempt := ParseRow(1, []string{
		"", "", "GEM/2099/B/TEST0003", "", "Client", "Scope", "", "", "",
		"", "", "", "", "Yes", "",
		"Closed", "Submitted", "", "", "",
		"", "", "", "", "",
	})
	if !gbxExempt.EMDExempted {
		t.Fatalf("expected EMDExempted to be true")
	}
	if gbxExempt.EMDExemptionType == nil || *gbxExempt.EMDExemptionType == "" {
		t.Errorf("GBX exempt row has no EMDExemptionType - will 400 on every future edit")
	}
	if gbxExempt.EMDExemptionReason == nil || *gbxExempt.EMDExemptionReason == "" {
		t.Errorf("GBX exempt row has no EMDExemptionReason")
	}

	dashRow := []string{
		"1", "GEM/2099/B/TEST0004", "GeM Link", "Bid", "1-Jan-2099", "0.5",
		"Someone", "A Client", "A Product", "1", "NA", "NA", "NA", "NA", "MSME Exempt", "",
		"", "", "", "", "", "", "", "", "", "", "", "",
	}
	dashExempt := ParseRowDashboard(2, dashRow, time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	if !dashExempt.EMDExempted {
		t.Fatalf("expected EMDExempted to be true")
	}
	if dashExempt.EMDExemptionType == nil || *dashExempt.EMDExemptionType == "" {
		t.Errorf("dashboard exempt row has no EMDExemptionType - will 400 on every future edit")
	}
	if dashExempt.EMDExemptionReason == nil || *dashExempt.EMDExemptionReason != "MSME Exempt" {
		t.Errorf("dashboard exempt row should keep the sheet's own remark as the reason, got %v", dashExempt.EMDExemptionReason)
	}
}

// TestGBXNoIdentifierRowsStillImport guards against a false read of the
// reconciliation data: rows whose id column reads "N/A - Quotation" (blank
// identifier) must still import under a title-based key, not be dropped.
func TestGBXNoIdentifierRowsStillImport(t *testing.T) {
	p, err := ParseWorkbook(gbxFixture)
	if err != nil {
		t.Fatalf("ParseWorkbook: %v", err)
	}
	if err := MarkDuplicates(nil, nil, p); err != nil {
		t.Fatalf("MarkDuplicates: %v", err)
	}
	row32 := findRow(t, p.Bids, 32)
	row33 := findRow(t, p.Bids, 33)
	if row32.Skip {
		t.Errorf("row 32 has no identifier but a distinct title and should import")
	}
	if row33.Skip {
		t.Errorf("row 33 has no identifier but a distinct title and should import")
	}
}
