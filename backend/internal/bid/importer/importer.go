package importer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/onetrack/backend/internal/bid/domain"
)

// DBTX is satisfied by both *pgxpool.Pool and pgx.Tx, so callers choose whether
// the import runs inside their own transaction.
type DBTX interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Duplicate records rows that share a bid id, client and scope.
type Duplicate struct {
	BidID string `json:"bid_id"`
	Rows  []int  `json:"rows"`
}

// SkippedRow describes a sheet row that will not be inserted because its
// tender identifier is already taken.
type SkippedRow struct {
	Row    int    `json:"row"`
	BidID  string `json:"bid_id"`
	Title  string `json:"title"`
	Reason string `json:"reason"`
	// Enriched lists the fields an existing tender was filled in with from this
	// row, when the row matched a live tender that had those fields blank.
	// Empty when nothing was enriched (in-sheet duplicates never enrich, and a
	// database match only enriches genuinely empty fields).
	Enriched []string `json:"enriched,omitempty"`
}

// SkippedSheet records a worksheet in the uploaded workbook that exists but was
// not imported, so the operator knows their data was seen and deliberately set
// aside rather than silently ignored.
type SkippedSheet struct {
	Name string `json:"name"`
	Rows int    `json:"rows"`
}

// Preview is the outcome of parsing a workbook without writing anything.
type Preview struct {
	Bids        []*ImportedBid `json:"bids"`
	StageCounts map[string]int `json:"stage_counts"`
	Duplicates  []Duplicate    `json:"duplicates"`
	WarningRows int            `json:"warning_rows"`
	// Skipped lists rows held back as duplicates; ImportCount is how many rows
	// will actually be inserted.
	Skipped       []SkippedRow   `json:"skipped"`
	ImportCount   int            `json:"import_count"`
	SkippedSheets []SkippedSheet `json:"skipped_sheets,omitempty"`
}

// ParseWorkbook reads and normalises a GBX Tracker format workbook from disk.
func ParseWorkbook(path string) (*Preview, error) {
	rows, err := ReadSheet(path)
	if err != nil {
		return nil, err
	}
	return buildPreview(rows, ExpectedHeaders, ParseRow)
}

// ParseUpload reads and normalises a GBX Tracker format workbook held in
// memory.
func ParseUpload(r io.ReaderAt, size int64) (*Preview, error) {
	rows, err := ReadSheetFrom(r, size)
	if err != nil {
		return nil, err
	}
	return buildPreview(rows, ExpectedHeaders, ParseRow)
}

// ParseWorkbookDashboard reads and normalises a Tender Dashboard format
// workbook from disk. Only the "TENDERS" sheet is imported; a "SUPPORTING
// BID" sheet, if present, is reported in Preview.SkippedSheets but left alone.
func ParseWorkbookDashboard(path string) (*Preview, error) {
	rows, err := ReadNamedSheet(path, dashboardSheetName)
	if err != nil {
		return nil, err
	}
	p, err := buildPreview(rows, ExpectedHeadersDashboard, ParseRowDashboard)
	if err != nil {
		return nil, err
	}
	if f, ferr := os.Open(path); ferr == nil {
		defer f.Close()
		if info, serr := f.Stat(); serr == nil {
			p.SkippedSheets = otherSheets(f, info.Size(), rows)
		}
	}
	return p, nil
}

// ParseUploadDashboard is ParseWorkbookDashboard for a workbook held in memory.
func ParseUploadDashboard(r io.ReaderAt, size int64) (*Preview, error) {
	rows, err := ReadNamedSheetFrom(r, size, dashboardSheetName)
	if err != nil {
		return nil, err
	}
	p, err := buildPreview(rows, ExpectedHeadersDashboard, ParseRowDashboard)
	if err != nil {
		return nil, err
	}
	p.SkippedSheets = otherSheets(r, size, rows)
	return p, nil
}

// otherSheets lists every worksheet in the workbook other than the one just
// imported, with its row count, so an operator can see that a second sheet
// existed and was deliberately not touched. Errors are swallowed - this is
// informational, not load-bearing, and must never fail an otherwise-good
// import.
func otherSheets(r io.ReaderAt, size int64, imported [][]string) []SkippedSheet {
	names, err := ListSheetNames(r, size)
	if err != nil {
		return nil
	}
	var out []SkippedSheet
	for _, name := range names {
		if strings.EqualFold(strings.TrimSpace(name), dashboardSheetName) {
			continue
		}
		rows, err := ReadNamedSheetFrom(r, size, name)
		if err != nil {
			continue
		}
		dataRows := 0
		for _, row := range rows[minInt(1, len(rows)):] {
			if !isEmptyRow(row) {
				dataRows++
			}
		}
		out = append(out, SkippedSheet{Name: name, Rows: dataRows})
	}
	return out
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func buildPreview(rows [][]string, expected []string, parseRow func(int, []string) *ImportedBid) (*Preview, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("sheet has no data rows")
	}
	if err := checkHeadersAgainst(rows[0], expected); err != nil {
		return nil, err
	}

	p := &Preview{StageCounts: map[string]int{}}
	for i, row := range rows[1:] {
		if isEmptyRow(row) {
			continue
		}
		p.Bids = append(p.Bids, parseRow(i+2, row))
	}
	p.Duplicates = findDuplicates(p.Bids)
	p.recount()
	return p, nil
}

// recount refreshes the counters that describe what will actually be imported,
// so they never include rows that are going to be skipped.
func (p *Preview) recount() {
	p.StageCounts = map[string]int{}
	p.Skipped = nil
	p.WarningRows = 0
	p.ImportCount = 0
	for _, b := range p.Bids {
		if len(b.Warnings) > 0 {
			p.WarningRows++
		}
		if b.Skip {
			p.Skipped = append(p.Skipped, SkippedRow{
				Row: b.RowNum, BidID: b.Identifier(), Title: b.Title, Reason: b.SkipReason,
			})
			continue
		}
		p.StageCounts[b.WorkflowStage]++
		p.ImportCount++
	}
}

// MarkDuplicates flags every row whose tender identifier is already taken, so
// the import adds only genuinely new tenders. Two sources of collision are
// checked: a tender already live in OneTrack, and an earlier row of this same
// sheet. Rows with no identifier at all (the sheet writes "NA") are always
// imported, since there is nothing to match them on.
//
// Passing a nil db checks the sheet against itself only.
func MarkDuplicates(ctx context.Context, db DBTX, p *Preview) error {
	seen := map[string]seenRow{}

	for _, b := range p.Bids {
		id := b.Identifier()

		// Rows the sheet left as "NA" have no identifier to match on, so they
		// fall back to title — otherwise re-uploading the same sheet would add
		// a fresh copy of them every time.
		key := strings.ToUpper(id)
		byTitle := id == ""
		if byTitle {
			key = "title:" + strings.ToUpper(b.Title)
		}

		if first, ok := seen[key]; ok {
			// One GeM bid can cover several product lines, which the tracker
			// records as separate rows sharing an id. They are one tender, so
			// the extra lines are folded into the first rather than dropped -
			// otherwise their bid value would vanish from the totals.
			if !byTitle {
				mergeLineItem(first.bid, b)
				b.Skip = true
				b.SkipReason = fmt.Sprintf("same tender id as row %d - merged into it as an extra product line", first.row)
				continue
			}
			b.Skip = true
			b.SkipReason = fmt.Sprintf("no tender id, and same title as row %d in this sheet", first.row)
			continue
		}
		seen[key] = seenRow{row: b.RowNum, bid: b}

		if db == nil {
			continue
		}

		var (
			existingID, existingTitle string
			err                       error
		)
		if byTitle {
			err = db.QueryRow(ctx, `
				SELECT id::text, title FROM bid.bid_workspaces
				WHERE archived_at IS NULL
				  AND UPPER(TRIM(title)) = UPPER($1)
				LIMIT 1`, b.Title).Scan(&existingID, &existingTitle)
		} else {
			err = db.QueryRow(ctx, `
				SELECT id::text, title FROM bid.bid_workspaces
				WHERE archived_at IS NULL
				  AND (UPPER(TRIM(gem_bid_no)) = UPPER($1) OR UPPER(TRIM(bid_no)) = UPPER($1))
				LIMIT 1`, id).Scan(&existingID, &existingTitle)
		}

		switch {
		case err == nil:
			b.Skip = true
			b.MatchedExistingID = &existingID
			if byTitle {
				b.SkipReason = fmt.Sprintf("no tender id; a tender titled %q already exists", existingTitle)
			} else {
				b.SkipReason = fmt.Sprintf("already in OneTrack as %q", existingTitle)
			}
		case errors.Is(err, pgx.ErrNoRows):
			// genuinely new
		default:
			return fmt.Errorf("row %d: duplicate check failed: %w", b.RowNum, err)
		}
	}

	p.recount()
	return nil
}

// EnrichDuplicates fills genuinely blank fields on an existing tender from a
// skipped row that matched it, instead of that row's data simply being
// discarded. Used for cross-file imports: the same GeM bid can be tracked in
// two different spreadsheets with different completeness, and whichever file
// is uploaded second should add to the record, not lose information to it.
//
// Only ever fills a field that is currently empty - nothing already recorded
// is overwritten. Call after MarkDuplicates and before/within the same
// transaction as InsertAll, so a failure here also rolls back the insert.
func EnrichDuplicates(ctx context.Context, db DBTX, p *Preview) error {
	for _, b := range p.Bids {
		if !b.Skip || b.MatchedExistingID == nil {
			continue
		}

		var (
			curRank          *string
			curQty           *int
			curRemarks       *string
			curCompetitorRaw []byte
		)
		err := db.QueryRow(ctx, `
			SELECT our_rank, quantity, remarks, competitor_info
			FROM bid.bid_workspaces WHERE id = $1`, *b.MatchedExistingID,
		).Scan(&curRank, &curQty, &curRemarks, &curCompetitorRaw)
		if err != nil {
			return fmt.Errorf("row %d: enrich lookup: %w", b.RowNum, err)
		}

		var sets []string
		var vals []any
		var enriched []string
		addSet := func(col string, val any, label string) {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, len(vals)+2))
			vals = append(vals, val)
			enriched = append(enriched, label)
		}

		if blank(curRank) && b.OurRank != nil && strings.TrimSpace(*b.OurRank) != "" {
			addSet("our_rank", strings.TrimSpace(*b.OurRank), "rank")
		}
		if curQty == nil && b.Quantity != nil {
			addSet("quantity", *b.Quantity, "quantity")
		}
		if isEmptyJSONArray(curCompetitorRaw) && len(b.Competitors) > 0 {
			cj, mErr := json.Marshal(b.Competitors)
			if mErr != nil {
				return fmt.Errorf("row %d: marshal competitor info: %w", b.RowNum, mErr)
			}
			addSet("competitor_info", cj, "competitor pricing")
		}
		if b.Remarks != nil && strings.TrimSpace(*b.Remarks) != "" {
			note := strings.TrimSpace(*b.Remarks)
			switch {
			case blank(curRemarks):
				addSet("remarks", note, "remarks")
			case !strings.Contains(*curRemarks, note):
				addSet("remarks", *curRemarks+" | "+note, "remarks")
			}
		}

		if len(sets) == 0 {
			continue
		}
		sets = append(sets, "updated_at = NOW()")
		query := fmt.Sprintf("UPDATE bid.bid_workspaces SET %s WHERE id = $1", strings.Join(sets, ", "))
		args := append([]any{*b.MatchedExistingID}, vals...)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			return fmt.Errorf("row %d: enrich update: %w", b.RowNum, err)
		}

		for i := range p.Skipped {
			if p.Skipped[i].Row == b.RowNum {
				p.Skipped[i].Enriched = enriched
				break
			}
		}
	}
	return nil
}

func blank(s *string) bool {
	return s == nil || strings.TrimSpace(*s) == ""
}

func isEmptyJSONArray(raw []byte) bool {
	s := strings.TrimSpace(string(raw))
	return s == "" || s == "[]" || s == "null"
}

// seenRow remembers both where an identifier was first seen and which parsed
// bid it belongs to, so later rows can be merged into it.
type seenRow struct {
	row int
	bid *ImportedBid
}

// mergeLineItem folds an extra product line into the tender that already holds
// this bid id: money is summed, the product names are combined, and a note is
// left on both so the merge is visible.
func mergeLineItem(into, extra *ImportedBid) {
	addMoney := func(dst **float64, add *float64) {
		if add == nil {
			return
		}
		if *dst == nil {
			v := *add
			*dst = &v
			return
		}
		v := **dst + *add
		*dst = &v
	}
	addMoney(&into.FinalPrice, extra.FinalPrice)
	addMoney(&into.QuotedPrice, extra.QuotedPrice)
	addMoney(&into.EstimatedValue, extra.EstimatedValue)
	addMoney(&into.EMDAmount, extra.EMDAmount)

	if extra.Quantity != nil {
		if into.Quantity == nil {
			q := *extra.Quantity
			into.Quantity = &q
		} else {
			q := *into.Quantity + *extra.Quantity
			into.Quantity = &q
		}
	}

	if len(extra.Competitors) > 0 {
		into.Competitors = append(into.Competitors, extra.Competitors...)
	}

	if extra.HighLevelScope != nil && *extra.HighLevelScope != "" {
		if into.HighLevelScope == nil || *into.HighLevelScope == "" {
			into.HighLevelScope = extra.HighLevelScope
		} else if !strings.Contains(*into.HighLevelScope, *extra.HighLevelScope) {
			combined := *into.HighLevelScope + "; " + *extra.HighLevelScope
			into.HighLevelScope = &combined
		}
		// The title is composed from client + scope, so rebuild it or the
		// merged tender would still be named after only its first product.
		if into.OrganizationName != nil && into.HighLevelScope != nil {
			title := *into.OrganizationName + " - " + *into.HighLevelScope
			if len(title) > 500 {
				title = title[:500]
			}
			into.Title = title
		}
	}

	into.warn("row %d shares this tender id and was merged in as an extra product line (values summed)", extra.RowNum)
}

// CheckHeaders rejects a GBX Tracker format workbook whose columns have moved
// or been renamed, rather than silently importing the wrong column into the
// wrong field.
func CheckHeaders(header []string) error {
	return checkHeadersAgainst(header, ExpectedHeaders)
}

// checkHeadersAgainst is CheckHeaders parameterised over which layout is
// expected, so the same guard works for every supported sheet format.
func checkHeadersAgainst(header []string, expected []string) error {
	for i, want := range expected {
		got := cell(header, i)
		if !strings.EqualFold(got, want) {
			return fmt.Errorf("column %d: expected %q, found %q - sheet layout has changed", i+1, want, got)
		}
	}
	return nil
}

func isEmptyRow(row []string) bool {
	for _, c := range row {
		if norm(c) != "" {
			return false
		}
	}
	return true
}

// findDuplicates reports rows that look like repeats. Bid IDs legitimately
// repeat when one tender covers several product line items, so callers should
// warn on these rather than block.
func findDuplicates(bids []*ImportedBid) []Duplicate {
	type entry struct {
		id   string
		rows []int
	}
	seen := map[string]*entry{}
	for _, b := range bids {
		id := derefStr(b.GemBidNo)
		if id == "" {
			id = derefStr(b.BidNo)
		}
		if id == "" {
			continue
		}
		key := strings.ToLower(id + "|" + derefStr(b.OrganizationName) + "|" + derefStr(b.HighLevelScope))
		if e, ok := seen[key]; ok {
			e.rows = append(e.rows, b.RowNum)
		} else {
			seen[key] = &entry{id: id, rows: []int{b.RowNum}}
		}
	}
	var out []Duplicate
	for _, e := range seen {
		if len(e.rows) > 1 {
			sort.Ints(e.rows)
			out = append(out, Duplicate{BidID: e.id, Rows: e.rows})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Rows[0] < out[j].Rows[0] })
	return out
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

const insertBidSQL = `
	INSERT INTO bid.bid_workspaces (
		bid_no, gem_bid_no, title, organization_name, department_name, portal_source,
		creation_mode, workflow_stage, bid_status,
		bid_owner_id, created_by,
		estimated_value, final_price, quoted_price,
		emd_amount, emd_exempted, emd_not_applicable,
		bg_required, bg_rate,
		high_level_scope, category,
		start_date, end_date, opening_date, closing_date,
		remarks, metadata,
		team, scope_type, activity_type, target_month_date,
		excel_bid_status, submission_status, technical_result,
		financial_evaluation_status, po_received_status, bid_result,
		submission_done, stage_completions, bid_outcome, quantity, our_rank,
		competitor_info
	) VALUES (
		$1,$2,$3,$4,$5,$6,
		$7,$8,$9,
		$10,$10,
		$11,$12,$13,
		$14,$15,$16,
		$17,$18,
		$19,$20,
		$21,$22,$21,$22,
		$23,$24,
		$25,$26,$27,$28,
		$29,$30,$31,
		$32,$33,$34,
		$35,$36,$37,$38,$39,
		$40
	) RETURNING id`

const insertHistorySQL = `
	INSERT INTO bid.bid_stage_history (
		bid_id, from_stage, to_stage, transition_reason, transitioned_by, event_type, details
	) VALUES ($1, NULL, $2, $3, $4, 'IMPORT', $5)`

// InsertAll writes every parsed bid plus one import audit entry each. Callers
// are expected to pass a transaction so a failure part-way leaves nothing
// behind.
func InsertAll(ctx context.Context, db DBTX, bids []*ImportedBid, ownerID, srcFile string) ([]string, error) {
	ids := make([]string, 0, len(bids))

	for _, b := range bids {
		if b.Skip {
			continue
		}
		completions, err := json.Marshal(b.StageCompletions)
		if err != nil {
			return nil, fmt.Errorf("row %d: marshal stage completions: %w", b.RowNum, err)
		}
		competitors := b.Competitors
		if competitors == nil {
			competitors = []domain.CompetitorInfo{}
		}
		competitorJSON, err := json.Marshal(competitors)
		if err != nil {
			return nil, fmt.Errorf("row %d: marshal competitor info: %w", b.RowNum, err)
		}
		metadata, err := json.Marshal(map[string]any{
			"imported":        true,
			"source_file":     trimPath(srcFile),
			"source_row":      b.RowNum,
			"import_warnings": b.Warnings,
		})
		if err != nil {
			return nil, fmt.Errorf("row %d: marshal metadata: %w", b.RowNum, err)
		}

		var id string
		err = db.QueryRow(ctx, insertBidSQL,
			b.BidNo, b.GemBidNo, b.Title, b.OrganizationName, b.DepartmentName, b.PortalSource,
			domain.CreationModeManual, b.WorkflowStage, b.BidStatus,
			ownerID,
			b.EstimatedValue, b.FinalPrice, b.QuotedPrice,
			b.EMDAmount, b.EMDExempted, b.EMDNotApplicable,
			b.BGRequired, b.BGRate,
			b.HighLevelScope, b.Category,
			b.StartDate, b.EndDate,
			b.Remarks, metadata,
			b.Team, b.ScopeType, b.ActivityType, b.TargetMonthDate,
			b.ExcelBidStatus, b.SubmissionStatus, b.TechnicalResult,
			b.FinancialEvaluationStatus, b.POReceivedStatus, b.BidResult,
			b.SubmissionDone, completions, b.BidOutcome, b.Quantity, b.OurRank,
			competitorJSON,
		).Scan(&id)
		if err != nil {
			return nil, fmt.Errorf("row %d (%s): insert: %w", b.RowNum, b.Title, err)
		}

		details, err := json.Marshal(map[string]any{
			"source_row": b.RowNum,
			"reason":     b.DerivationReason,
			"warnings":   b.Warnings,
		})
		if err != nil {
			return nil, fmt.Errorf("row %d: marshal history details: %w", b.RowNum, err)
		}
		note := fmt.Sprintf("Imported from %s (row %d): %s", trimPath(srcFile), b.RowNum, b.DerivationReason)
		if _, err := db.Exec(ctx, insertHistorySQL, id, b.WorkflowStage, note, ownerID, details); err != nil {
			return nil, fmt.Errorf("row %d: insert history: %w", b.RowNum, err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// ResolveOwner accepts a UUID, username or email and returns the user id.
func ResolveOwner(ctx context.Context, db DBTX, owner string) (string, error) {
	var id string
	err := db.QueryRow(ctx, `
		SELECT id::text FROM auth.users
		WHERE id::text = $1 OR LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
		LIMIT 1`, owner).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("could not resolve owner %q: %w", owner, err)
	}
	return id, nil
}

func trimPath(p string) string {
	if i := strings.LastIndexAny(p, `/\`); i >= 0 {
		return p[i+1:]
	}
	return p
}
