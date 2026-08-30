package importer

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/onetrack/backend/internal/bid/domain"
)

// dashboardSheetName is the worksheet tab this format's data lives on. The
// workbook also carries a "SUPPORTING BID" tab, which is deliberately not
// imported - it is almost entirely blank (39 of 40 rows have no status or
// result recorded at all) and is reported to the operator rather than parsed.
const dashboardSheetName = "TENDERS"

// Column positions in the Tender Dashboard "TENDERS" sheet (A..AB).
const (
	dcSlNo = iota
	dcBidNo
	dcBidType
	dcNatureOfBid
	dcEndDate
	dcEndTime
	dcBidOwner
	dcCustomer
	dcProduct
	dcQty
	dcTenderFee
	dcEMDAmount
	dcBGPercent
	dcBGDuration
	dcEMDRemark
	dcEMDStatus
	dcBidStatus
	dcL1Bidder
	dcL1Price
	dcL2Bidder
	dcL2Price
	dcL3Bidder
	dcL3Price
	dcL4Bidder
	dcL4Price
	dcFinalPriceAfterRA
	dcGemLink
	dcRemarks
	dcCount
)

// ExpectedHeadersDashboard guards against a re-ordered or differently-shaped
// sheet. Compared against the normalised (whitespace-collapsed) header text,
// so a stray newline in a cell like "L3\n Bidder" still matches "L3 Bidder".
var ExpectedHeadersDashboard = []string{
	"Sl No", "Bid No", "Bid Type", "Nature Of Bid", "End Date", "End Time",
	"Bid Owner", "Customer Details", "Product Details", "Qty",
	"Tender Fee", "EMD Amount", "BG (%)", "Duration of BG", "EMD Remark", "EMD Status",
	"Bid Status", "L1 Bidder", "L1 Bidder Price", "L2 Bidder", "L2 Bidder Price",
	"L3 Bidder", "L3 Bidder Price", "L4 Bidder", "L4 Bidder Price",
	"Final Price After RA", "Gem Link", "Remarks",
}

// ourNames identifies the entities GlobX itself bids under. Confirmed against
// the client's data: GLOBX, GLTECH and GL TECH are all the same company, not
// three different bidders - a handful of tenders were won while bidding under
// the GLTECH name.
var ourNames = map[string]bool{
	"GLOBX": true, "GLTECH": true, "GL TECH": true,
}

func isOurName(s string) bool {
	return ourNames[strings.ToUpper(strings.TrimSpace(s))]
}

var dashboardBidTypeMap = map[string]string{
	"gem link": "GeM", "gem link and boq": "GeM",
	"costume": "Private", "custom bid for services": "Private",
	"mannual": "Private", "manual": "Private", "boq": "Private", "service": "Private",
}

func canonDashboardPlatform(s string) string {
	v := normLower(s)
	if strings.Contains(v, "e-tender") || strings.Contains(v, "e tender") ||
		strings.Contains(v, "enivida") || strings.Contains(v, "ariba") ||
		strings.Contains(v, "mstc") || strings.Contains(v, "ocac") {
		return "Private"
	}
	if p, ok := dashboardBidTypeMap[v]; ok {
		return p
	}
	if isBlank(s) {
		return "GeM"
	}
	return "Private"
}

func canonDashboardActivity(s string) string {
	v := normLower(s)
	if strings.HasPrefix(v, "bid to ra") {
		return "Bid to RA"
	}
	if strings.HasPrefix(v, "bid") {
		return "Bid"
	}
	return norm(s)
}

// ParseRowDashboard maps one Tender Dashboard "TENDERS" sheet row onto the
// OneTrack schema. now anchors every deadline-relative judgement call
// (open-vs-closed) so that a single import run derives every row against the
// same instant, rather than each row's outcome depending on how long the
// request took to reach it.
func ParseRowDashboard(rowNum int, row []string, now time.Time) *ImportedBid {
	b := &ImportedBid{RowNum: rowNum, StageCompletions: map[string]bool{}}

	client := cell(row, dcCustomer)
	scope := cell(row, dcProduct)

	switch {
	case client != "" && scope != "":
		b.Title = fmt.Sprintf("%s - %s", client, scope)
	case scope != "":
		b.Title = scope
	case client != "":
		b.Title = client
	default:
		b.Title = fmt.Sprintf("Imported tender (row %d)", rowNum)
		b.warn("row has neither client nor product; generated placeholder title")
	}
	if len(b.Title) > 500 {
		b.Title = b.Title[:500]
	}

	b.OrganizationName = strPtr(client)
	b.DepartmentName = strPtr(client)
	b.HighLevelScope = strPtr(scope)
	b.Team = strPtr("GSN_ETS")
	b.ScopeType = nil
	b.ActivityType = strPtr(canonDashboardActivity(cell(row, dcNatureOfBid)))
	b.PortalSource = canonDashboardPlatform(cell(row, dcBidType))

	if id := cell(row, dcBidNo); !isBlank(id) {
		if strings.HasPrefix(strings.ToUpper(id), "GEM/") {
			b.GemBidNo = strPtr(id)
		} else {
			b.BidNo = strPtr(id)
		}
	}

	if q, ok := ParseQuantity(cell(row, dcQty)); ok {
		b.Quantity = &q
	}

	// --- EMD -------------------------------------------------------------
	emdRaw := cell(row, dcEMDAmount)
	if amt, ok, w := ParseMoney(emdRaw); ok {
		b.EMDAmount = &amt
		b.warnRaw(w)
	} else if !isBlank(emdRaw) {
		b.warnRaw(w)
	}
	// This sheet has no EMD-exemption flag, only a free-text EMD Remark such as
	// "Emd Exemption" or a validity note. Exemption is only recorded when the
	// remark actually says so; everything else stays a plain remark.
	emdRemark := cell(row, dcEMDRemark)
	if strings.Contains(normLower(emdRemark), "exempt") {
		b.EMDExempted = true
		// Same placeholder as the GBX format: an exempt record needs a type
		// that satisfies validateEMDExemption or every later edit 400s. The
		// sheet's own remark becomes the reason when there is one to keep.
		b.EMDExemptionType = strPtr("OTHER")
		reason := strings.TrimSpace(emdRemark)
		if reason == "" {
			reason = "Imported from legacy tracker - exemption basis not recorded in source, please verify"
		}
		b.EMDExemptionReason = strPtr(reason)
	}
	if b.EMDAmount == nil && !b.EMDExempted {
		b.EMDNotApplicable = true
	}

	// --- Bank guarantee ----------------------------------------------------
	if rate, ok, w := ParseRate(cell(row, dcBGPercent)); ok {
		b.BGRequired = true
		b.BGRate = &rate
		b.warnRaw(w)
	}

	// --- Dates ---------------------------------------------------------
	// End Time is a separate column holding the fraction of a day (Excel's
	// native time representation), so it is folded into End Date to give a
	// real closing timestamp instead of always reading midnight.
	if t, ok, w := ParseDate(cell(row, dcEndDate)); ok {
		if frac, tok := parseTimeFraction(cell(row, dcEndTime)); tok {
			t = t.Add(timeOfDay(frac))
		}
		b.EndDate = &t
		month := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
		b.TargetMonthDate = &month
		b.warnRaw(w)
	} else {
		b.warnRaw(w)
	}

	// --- Money -----------------------------------------------------------
	l1Price, hasL1Price, w := ParseMoney(cell(row, dcL1Price))
	b.warnRaw(w)
	finalRA, hasFinalRA, w := ParseMoney(cell(row, dcFinalPriceAfterRA))
	b.warnRaw(w)

	weWonOnPrice := hasL1Price && isOurName(cell(row, dcL1Bidder))
	switch {
	case hasFinalRA:
		b.FinalPrice = &finalRA
		b.QuotedPrice = &finalRA
	case weWonOnPrice:
		b.FinalPrice = &l1Price
		b.QuotedPrice = &l1Price
	}

	// --- Competitor intelligence: L1-L4 bidder name + price ---------------
	b.Competitors = parseCompetitors(row)

	// --- Remarks: fold in the columns this schema has no field for --------
	var remarkParts []string
	if bidOwner := cell(row, dcBidOwner); bidOwner != "" {
		remarkParts = append(remarkParts, "Bid Owner (sheet): "+bidOwner)
	}
	if fee := cell(row, dcTenderFee); !isBlank(fee) {
		remarkParts = append(remarkParts, "Tender Fee: "+fee)
	}
	if dur := cell(row, dcBGDuration); !isBlank(dur) {
		remarkParts = append(remarkParts, "BG Duration: "+dur)
	}
	if !isBlank(emdRemark) && !strings.Contains(normLower(emdRemark), "exempt") {
		remarkParts = append(remarkParts, "EMD Remark: "+emdRemark)
	}
	if link := cell(row, dcGemLink); !isBlank(link) {
		remarkParts = append(remarkParts, "Link: "+link)
	}
	if r := cell(row, dcRemarks); !isBlank(r) {
		remarkParts = append(remarkParts, r)
	}
	b.Remarks = strPtr(strings.Join(remarkParts, " | "))

	deriveStageDashboard(b, row, now)
	return b
}

// parseCompetitors reads the L1-L4 Bidder/Price column pairs into the shape
// bid.competitor_info already uses (name, quoted_price, rank), so this data
// renders on the tender detail page without any new field.
func parseCompetitors(row []string) []domain.CompetitorInfo {
	var out []domain.CompetitorInfo
	pairs := []struct {
		nameCol, priceCol int
		rank              string
	}{
		{dcL1Bidder, dcL1Price, "L1"},
		{dcL2Bidder, dcL2Price, "L2"},
		{dcL3Bidder, dcL3Price, "L3"},
		{dcL4Bidder, dcL4Price, "L4"},
	}
	for _, p := range pairs {
		name := cell(row, p.nameCol)
		if isBlank(name) {
			continue
		}
		info := domain.CompetitorInfo{Name: norm(name), Rank: strPtr(p.rank)}
		if price, ok, _ := ParseMoney(cell(row, p.priceCol)); ok {
			info.QuotedPrice = &price
		}
		out = append(out, info)
	}
	return out
}

// deriveStageDashboard turns this sheet's single, free-text "Bid Status"
// column into a real lifecycle position.
//
// Unlike the GBX Tracker format, this sheet has no separate open/closed flag
// and no PO/award column - "Bid Status" itself carries the outcome (or is
// blank when nothing has been decided yet), so the rules below read directly
// off it plus the End Date, rather than the two-signal approach used for GBX.
//
// A closed tender whose outcome was never actually recorded is imported as
// CLOSED with no bid_outcome, not guessed as Lost - guessing fabricates a
// loss the team never reported, and the wrong direction to err in.
func deriveStageDashboard(b *ImportedBid, row []string, now time.Time) {
	status := norm(cell(row, dcBidStatus))
	statusLower := normLower(status)
	remark := normLower(cell(row, dcRemarks))
	l1Bidder := cell(row, dcL1Bidder)
	rank, hasRank := LRank(status)

	var stage, reached, bidStatus, reason string

	switch {
	case strings.Contains(remark, "cancel"):
		stage, reached = domain.StageCancelled, domain.StageGeMSubmission
		bidStatus = domain.BidStatusCancelled
		reason = "cancelled"

	case statusLower == "":
		// Nothing recorded yet: still open if the deadline hasn't passed,
		// otherwise the team never came back to update it after the bid
		// closed - treated as closed without a recorded outcome, same as an
		// unaddressed row in the GBX format.
		if b.EndDate != nil && b.EndDate.After(now) {
			stage, reached = domain.StageDiscovered, domain.StageDiscovered
			bidStatus = domain.BidStatusActive
			reason = "open - tracked, deadline not yet reached"
		} else {
			stage, reached = domain.StageDiscovered, domain.StageDiscovered
			bidStatus = domain.BidStatusClosed
			reason = "closed - no status ever recorded"
		}

	case statusLower == "l1" && isOurName(l1Bidder):
		stage, reached = domain.StageAwardHandover, domain.StageFinancialEvaluation
		bidStatus = domain.BidStatusWon
		reason = "L1 (lowest bidder)"

	case strings.HasPrefix(statusLower, "l1-") || (statusLower == "l1" && !isOurName(l1Bidder)):
		// "L1-<company>" explicitly names who placed first when it wasn't us.
		stage, reached = domain.StageLost, domain.StageFinancialEvaluation
		bidStatus = domain.BidStatusLost
		reason = "lost - another bidder placed L1"

	case hasRank && rank > 1:
		stage, reached = domain.StageLost, domain.StageFinancialEvaluation
		bidStatus = domain.BidStatusLost
		reason = fmt.Sprintf("closed at L%d", rank)

	case strings.Contains(statusLower, "ra no") || strings.Contains(statusLower, "ra start") || strings.Contains(statusLower, "ra end"):
		// A reverse-auction schedule with no result yet: still in play.
		stage, reached = domain.StageFinancialEvaluation, domain.StageTechnicalEvaluation
		bidStatus = domain.BidStatusActive
		reason = "reverse auction in progress"

	case strings.Contains(statusLower, "not participated"):
		stage, reached = domain.StageDiscovered, domain.StageDiscovered
		bidStatus = domain.BidStatusClosed
		reason = "closed without bidding"
		b.warn("bid status explains a non-participation reason - kept verbatim in remarks")

	case statusLower == "qualified" || strings.Contains(statusLower, "qualified"):
		if b.EndDate != nil && !b.EndDate.After(now) {
			// Qualified with the deadline long past and nothing further
			// recorded: the team never logged a final outcome. Stage and
			// status must agree - a resolved outcome paired with a
			// still-open FINANCIAL_EVALUATION stage is exactly the kind of
			// mismatch that made "Under Tech Eval" list won/lost tenders in
			// the GBX importer, so this stays parked at the stage it
			// actually reached with the outcome left unrecorded.
			stage, reached = domain.StageFinancialEvaluation, domain.StageFinancialEvaluation
			bidStatus = domain.BidStatusClosed
			reason = "qualified but no result ever recorded"
			b.warn("qualified with the bid deadline passed and no final result recorded - imported as Closed with no outcome, please verify")
		} else {
			stage, reached = domain.StageFinancialEvaluation, domain.StageTechnicalEvaluation
			bidStatus = domain.BidStatusActive
			reason = "qualified, awaiting result"
		}

	case statusLower == "participated" || statusLower == "particiapted":
		stage, reached = domain.StageFinancialEvaluation, domain.StageFinancialEvaluation
		bidStatus = domain.BidStatusClosed
		reason = "participated, no result ever recorded"
		b.warn("marked participated with no final result recorded - imported as Closed with no outcome, please verify")

	default:
		// Free text that doesn't match a known pattern (e.g. a bespoke
		// disqualification explanation) - the outcome is genuinely unknown,
		// so it is kept Closed with the raw text preserved in remarks and
		// flagged for a human to read, rather than guessed as a loss.
		stage, reached = domain.StageFinancialEvaluation, domain.StageFinancialEvaluation
		bidStatus = domain.BidStatusClosed
		reason = "closed - see remarks for the recorded status"
		b.warn("bid status %q did not match a known pattern - imported as Closed with no outcome, text kept in remarks, please verify", status)
	}

	b.WorkflowStage = stage
	b.BidStatus = bidStatus
	b.DerivationReason = reason
	b.SubmissionDone = statusLower != ""

	switch bidStatus {
	case domain.BidStatusWon:
		b.BidOutcome = strPtr(domain.OutcomeWon)
	case domain.BidStatusLost:
		b.BidOutcome = strPtr(domain.OutcomeLost)
	case domain.BidStatusCancelled:
		b.BidOutcome = strPtr(domain.OutcomeCancelled)
	}

	// Our own position, for the "Our Rank" column: L1 when we won, otherwise
	// whatever rank the sheet recorded (if any) after our name.
	if bidStatus == domain.BidStatusWon {
		b.OurRank = strPtr("L1")
	} else if hasRank {
		b.OurRank = strPtr(fmt.Sprintf("L%d", rank))
	}

	for _, s := range domain.OrderedWorkflowStages {
		b.StageCompletions[s] = true
		if s == reached {
			break
		}
	}
	if stage != domain.StageDiscovered {
		delete(b.StageCompletions, stage)
	}
}

// parseTimeFraction reads Excel's fraction-of-a-day time representation, e.g.
// "0.625" for 3:00 PM (0.625 * 24h). Values outside [0, 1) are rejected as not
// being a time-of-day at all.
func parseTimeFraction(s string) (float64, bool) {
	raw := norm(s)
	if isBlank(raw) {
		return 0, false
	}
	f, err := strconv.ParseFloat(raw, 64)
	if err != nil || f < 0 || f >= 1 {
		return 0, false
	}
	return f, true
}

// timeOfDay converts a day-fraction to a duration, rounded to the nearest
// second. Excel's fractions are rarely exact in float64 (13:00 is stored as
// 0.5416666666666666, not 0.5416666...7), so truncating - rather than
// rounding - systematically lands one second before the intended time.
func timeOfDay(frac float64) time.Duration {
	return time.Duration(math.Round(frac * float64(24*time.Hour)))
}
