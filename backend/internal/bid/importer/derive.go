package importer

import (
	"fmt"
	"strings"
	"time"

	"github.com/onetrack/backend/internal/bid/domain"
)

// Column positions in the GBX Tracker sheet (A..Y).
//
// This is the authority's finalised 25-column layout. It supersedes the earlier
// 23-column sheet: columns were reordered, Quantity and Price Ranking were
// added, "Month" became a real "Reporting Month" label and the free-text result
// was split into an explicit "Final Result" plus a separate "Price Ranking".
const (
	colCategory = iota
	colTeam
	colBidID
	colPlatform
	colClient
	colScope
	colQuantity
	colScopeType
	colActivityType
	colReportingMonth
	colStartDate
	colEndDate
	colEMD
	colEMDExemption
	colBG
	colBidStatus
	colSubmissionStatus
	colTechEval
	colFinEval
	colPOStatus
	colBidValue
	colEstimatedValue
	colPriceRanking
	colFinalResult
	colRemark
	colCount
)

// ExpectedHeaders guards against a re-ordered or differently-shaped sheet. Only
// this layout is accepted - an older workbook is rejected with a clear message
// rather than silently importing the wrong column into the wrong field.
var ExpectedHeaders = []string{
	"Category", "Team", "RFP/BID ID", "Platform", "Client/Department",
	"High Level Scope", "Quantity", "Scope Type", "Activity Type",
	"Reporting Month", "Start Date", "End Date",
	"EMD Amount (INR)", "EMD Exemption", "Bank Guarantee (%)",
	"Bid Status", "Bid Submission Status", "Technical Evaluation",
	"Financial Evaluation", "PO Status", "Bid Value (INR)",
	"Estimated Value (INR)", "Price Ranking", "Final Result", "Remark",
}

// ImportedBid is one fully normalised tracker row, ready to insert.
type ImportedBid struct {
	RowNum int

	Title            string
	BidNo            *string
	GemBidNo         *string
	OrganizationName *string
	DepartmentName   *string
	HighLevelScope   *string
	Category         *string
	PortalSource     string
	Team             *string
	ScopeType        *string
	ActivityType     *string

	EMDAmount        *float64
	EMDExempted      bool
	EMDNotApplicable bool
	BGRequired       bool
	BGRate           *float64

	TargetMonthDate *time.Time
	StartDate       *time.Time
	EndDate         *time.Time

	EstimatedValue *float64
	FinalPrice     *float64
	QuotedPrice    *float64
	Quantity       *int
	OurRank        *string

	ExcelBidStatus            *string
	SubmissionStatus          *string
	TechnicalResult           *string
	FinancialEvaluationStatus *string
	POReceivedStatus          *string
	BidResult                 *string
	Remarks                   *string

	// Competitors holds per-bidder name/price/rank rows, when the sheet records
	// them (the Tender Dashboard format's L1-L4 Bidder columns). Written
	// straight into bid.competitor_info, which the tender detail page already
	// renders - no new field was needed for this.
	Competitors []domain.CompetitorInfo

	// Skip marks a row that must not be inserted because its tender identifier
	// is already taken - either by a live tender in OneTrack, or by an earlier
	// row in this same sheet.
	Skip       bool
	SkipReason string

	// MatchedExistingID is the id of the live OneTrack tender this row's
	// identifier collided with, when Skip was set because of a database match
	// (as opposed to an earlier row in the same sheet). Lets a caller enrich
	// that existing tender with any field this row has that the existing one
	// is missing, instead of the row's data simply being discarded.
	MatchedExistingID *string

	WorkflowStage    string
	BidStatus        string
	BidOutcome       *string
	SubmissionDone   bool
	StageCompletions map[string]bool
	DerivationReason string

	Warnings []string
}

// Identifier returns the tender's real-world key - the GeM bid number when the
// sheet supplied one, otherwise the RFP number. Empty when the row had no
// usable id (the sheet writes "NA" for these).
func (b *ImportedBid) Identifier() string {
	if b.GemBidNo != nil && strings.TrimSpace(*b.GemBidNo) != "" {
		return strings.TrimSpace(*b.GemBidNo)
	}
	if b.BidNo != nil && strings.TrimSpace(*b.BidNo) != "" {
		return strings.TrimSpace(*b.BidNo)
	}
	return ""
}

func (b *ImportedBid) warn(format string, args ...any) {
	if format == "" {
		return
	}
	b.Warnings = append(b.Warnings, fmt.Sprintf(format, args...))
}

func (b *ImportedBid) warnRaw(s string) {
	if s != "" {
		b.Warnings = append(b.Warnings, s)
	}
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func cell(row []string, idx int) string {
	if idx < len(row) {
		return norm(row[idx])
	}
	return ""
}

// ParseRow maps one spreadsheet row onto the OneTrack schema, cleaning every
// value and recording a warning wherever a judgement call was made.
func ParseRow(rowNum int, row []string) *ImportedBid {
	b := &ImportedBid{RowNum: rowNum, StageCompletions: map[string]bool{}}

	client := cell(row, colClient)
	scope := cell(row, colScope)

	// The sheet has no title column; compose one and keep scope verbatim too.
	switch {
	case client != "" && scope != "":
		b.Title = fmt.Sprintf("%s - %s", client, scope)
	case scope != "":
		b.Title = scope
	case client != "":
		b.Title = client
	default:
		b.Title = fmt.Sprintf("Imported tender (row %d)", rowNum)
		b.warn("row has neither client nor scope; generated placeholder title")
	}
	if len(b.Title) > 500 {
		b.Title = b.Title[:500]
	}

	// The tracker's single "Client/Department" value feeds both fields: cards
	// read organization_name, the spreadsheet view reads department_name.
	b.OrganizationName = strPtr(client)
	b.DepartmentName = strPtr(client)
	b.HighLevelScope = strPtr(scope)
	b.Category = strPtr(canon(cell(row, colCategory), categoryMap))
	b.Team = strPtr(cell(row, colTeam))
	b.ScopeType = strPtr(canon(cell(row, colScopeType), scopeTypeMap))
	b.ActivityType = strPtr(canon(cell(row, colActivityType), activityTypeMap))

	// Bid identifier: GeM IDs go in gem_bid_no, everything else in bid_no.
	if id := cell(row, colBidID); !isBlank(id) {
		if strings.HasPrefix(strings.ToUpper(id), "GEM/") {
			b.GemBidNo = strPtr(id)
		} else {
			b.BidNo = strPtr(id)
		}
	}

	b.PortalSource = cell(row, colPlatform)
	if b.PortalSource == "" {
		b.PortalSource = "GeM"
	}

	// --- EMD -----------------------------------------------------------
	emdRaw := cell(row, colEMD)
	exemptRaw := normLower(cell(row, colEMDExemption))
	if amt, ok, w := ParseMoney(emdRaw); ok {
		b.EMDAmount = &amt
		b.warnRaw(w)
	} else if !isBlank(emdRaw) {
		b.warnRaw(w)
	}
	switch exemptRaw {
	case "yes":
		b.EMDExempted = true
	case "no":
		b.EMDExempted = false
	default:
		b.EMDExempted = false
	}
	// No amount and not an explicit exemption means EMD simply did not apply.
	if b.EMDAmount == nil && !b.EMDExempted {
		b.EMDNotApplicable = true
	}

	// --- Bank guarantee ------------------------------------------------
	bgRaw := cell(row, colBG)
	if rate, ok, w := ParseRate(bgRaw); ok {
		b.BGRequired = true
		b.BGRate = &rate
		b.warnRaw(w)
	} else {
		b.BGRequired = false
		b.warnRaw(w)
	}

	// --- Dates ---------------------------------------------------------
	if t, ok, w := ParseReportingMonth(cell(row, colReportingMonth)); ok {
		b.TargetMonthDate = &t
		b.warnRaw(w)
	}
	if t, ok, w := ParseDate(cell(row, colStartDate)); ok {
		b.StartDate = &t
		b.warnRaw(w)
	} else {
		b.warnRaw(w)
	}
	if t, ok, w := ParseDate(cell(row, colEndDate)); ok {
		b.EndDate = &t
		b.warnRaw(w)
	} else {
		b.warnRaw(w)
	}
	if b.StartDate != nil && b.EndDate != nil && b.EndDate.Before(*b.StartDate) {
		b.warn("end date %s precedes start date %s",
			b.EndDate.Format("2006-01-02"), b.StartDate.Format("2006-01-02"))
	}

	// --- Money ---------------------------------------------------------
	// The tracker's "Bid Value" is the price GlobX submitted. The app surfaces
	// that as quoted_price ("GlobX Total"), so populate both.
	if v, ok, w := ParseMoney(cell(row, colBidValue)); ok {
		b.FinalPrice = &v
		b.QuotedPrice = &v
		b.warnRaw(w)
	}
	if q, ok := ParseQuantity(cell(row, colQuantity)); ok {
		b.Quantity = &q
	}
	// "Price Ranking" is now its own column (L1, L2, ... H1), so the position no
	// longer has to be scraped out of free text.
	b.OurRank = strPtr(CanonRank(cell(row, colPriceRanking)))

	estRaw := cell(row, colEstimatedValue)
	if v, ok, w := ParseMoney(estRaw); ok {
		b.EstimatedValue = &v
		b.warnRaw(w)
	}

	// --- Status columns (raw text preserved for audit) -----------------
	b.ExcelBidStatus = strPtr(cell(row, colBidStatus))
	b.SubmissionStatus = strPtr(canon(cell(row, colSubmissionStatus), submissionMap))
	// Technical evaluation and PO receipt are enums the rest of the app writes
	// and reads, so the sheet's free text is mapped onto those exact values.
	b.TechnicalResult = strPtr(CanonTechnicalResult(cell(row, colTechEval)))
	b.POReceivedStatus = strPtr(CanonPOStatus(cell(row, colPOStatus)))
	// Financial evaluation has no enum - the sheet's own wording is what the
	// spreadsheet view displays, so it is kept as cleaned free text.
	b.FinancialEvaluationStatus = strPtr(canon(cell(row, colFinEval), evalMap))
	b.BidResult = strPtr(cell(row, colFinalResult))

	// Remarks: the sheet's own remark, plus any prose rescued from the
	// Estimated Value column so the note is not silently dropped.
	var remarkParts []string
	if r := cell(row, colRemark); !isBlank(r) {
		remarkParts = append(remarkParts, r)
	}
	if b.EstimatedValue == nil && !isBlank(estRaw) {
		remarkParts = append(remarkParts, "Estimated value note: "+estRaw)
	}
	b.Remarks = strPtr(strings.Join(remarkParts, " | "))

	deriveStage(b, row)
	return b
}

// deriveStage turns the tracker's status columns into a real lifecycle position.
//
// The sheet records two independent facts and both are needed:
//
//   - "Bid Status" (Closed / Active) says whether the tender is still being
//     worked. It is the team's own statement and is the authority on that.
//   - "Final Result", "Price Ranking" and the evaluation columns say what
//     happened to the bid.
//
// So the status is settled from Bid Status first, and only then is the outcome
// resolved. Final Result is now an explicit enum (Awarded / Not Awarded /
// Disqualified / Cancelled / Result Pending / Bid In Progress / On Hold), so it
// is trusted ahead of the older signals; Price Ranking gives the position
// directly instead of it being scraped out of free text.
func deriveStage(b *ImportedBid, row []string) {
	sheetStatus := normLower(cell(row, colBidStatus))
	submission := normLower(cell(row, colSubmissionStatus))
	tech := normLower(cell(row, colTechEval))
	fin := normLower(cell(row, colFinEval))
	po := normLower(cell(row, colPOStatus))
	result := normLower(cell(row, colFinalResult))
	rank := CanonRank(cell(row, colPriceRanking))

	disqualified := tech == "disqualified" || fin == "disqualified" || result == "disqualified"
	neverBid := submission == "not submitted" || submission == "not participated"

	// reached is the furthest workflow stage the bid actually got to; it drives
	// the stage_completions backfill and can differ from the final stage when
	// the bid ended in a terminal state.
	var stage, reached, status, reason string

	switch {
	// ── Still open per the tracker ───────────────────────────────────────
	case sheetStatus == "active" && !disqualified:
		status = domain.BidStatusActive
		switch {
		case fin == "qualified" || fin == "completed" || tech == "qualified":
			stage, reached = domain.StageFinancialEvaluation, domain.StageTechnicalEvaluation
			reason = "open - awaiting financial outcome"
		case tech != "" && tech != "not submitted":
			stage, reached = domain.StageTechnicalEvaluation, domain.StageGeMSubmission
			reason = "open - under evaluation"
		case submission == "submitted":
			stage, reached = domain.StageGeMSubmission, domain.StageGeMSubmission
			reason = "open - submitted, awaiting evaluation"
		default:
			stage, reached = domain.StageDiscovered, domain.StageDiscovered
			reason = "open - identified, not yet bid"
		}

	// ── Closed per the tracker ──────────────────────────────────────────
	case result == "awarded":
		// Won. The stage stays at Award & Handover so delivery, BG discharge and
		// handover can still be completed; bid_status is what marks it won.
		stage, reached = domain.StageAwardHandover, domain.StageFinancialEvaluation
		status = domain.BidStatusWon
		reason = "awarded"
		if po != "received" {
			b.warn("recorded as Awarded but PO status reads %q - imported as Won",
				cell(row, colPOStatus))
		}

	case result == "cancelled" || po == "bid cancelled":
		stage, reached = domain.StageCancelled, domain.StageGeMSubmission
		status = domain.BidStatusCancelled
		reason = "cancelled"

	case neverBid:
		// Assessed, then dropped without bidding. The stage stays at Discovered
		// because that is genuinely as far as it got; CLOSED on bid_status is
		// what takes it out of the active pipeline.
		stage, reached = domain.StageDiscovered, domain.StageDiscovered
		status = domain.BidStatusClosed
		reason = "closed without bidding"

	case disqualified:
		stage = domain.StageLost
		reached = domain.StageTechnicalEvaluation
		if fin == "disqualified" {
			reached = domain.StageFinancialEvaluation
		}
		status = domain.BidStatusLost
		reason = "disqualified in evaluation"

	case result == "not awarded":
		stage, reached = domain.StageLost, domain.StageFinancialEvaluation
		status = domain.BidStatusLost
		reason = "not awarded"

	case rank != "" && rank != "L1":
		// Closed with a recorded position other than first: the bid was decided
		// and went elsewhere.
		stage, reached = domain.StageLost, domain.StageFinancialEvaluation
		status = domain.BidStatusLost
		reason = fmt.Sprintf("closed at %s", rank)

	case fin == "completed":
		stage, reached = domain.StageLost, domain.StageFinancialEvaluation
		status = domain.BidStatusLost
		reason = "evaluation completed, no PO"

	default:
		stage, reached = domain.StageLost, domain.StageFinancialEvaluation
		status = domain.BidStatusLost
		reason = "closed without a recorded win"
		b.warn("closed but the outcome columns are inconclusive - imported as Lost, please verify")
	}

	b.WorkflowStage = stage
	b.BidStatus = status
	b.DerivationReason = reason
	b.SubmissionDone = submission == "submitted"

	// bid_outcome is read alongside bid_status by the dashboard and analytics
	// queries, so it is set here too or the counts would disagree with the
	// tender list.
	switch status {
	case domain.BidStatusWon:
		b.BidOutcome = strPtr(domain.OutcomeWon)
	case domain.BidStatusLost:
		b.BidOutcome = strPtr(domain.OutcomeLost)
	case domain.BidStatusCancelled:
		b.BidOutcome = strPtr(domain.OutcomeCancelled)
	}

	// Backfill: every stage up to and including `reached` is complete, so a bid
	// at Financial Evaluation does not render with untouched earlier stages.
	for _, s := range domain.OrderedWorkflowStages {
		b.StageCompletions[s] = true
		if s == reached {
			break
		}
	}
	// The stage a bid is currently sitting in is work in progress, not done -
	// except Discovered, which creating the record already satisfies.
	if stage != domain.StageDiscovered {
		delete(b.StageCompletions, stage)
	}
}
