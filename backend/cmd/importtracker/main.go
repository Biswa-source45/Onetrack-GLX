package main

import (
	"context"
	"encoding/csv"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"github.com/onetrack/backend/internal/bid/domain"
	"github.com/onetrack/backend/internal/bid/importer"
)

func main() {
	_ = godotenv.Load()

	var (
		file    = flag.String("file", "", "path to the tracker .xlsx (required)")
		format  = flag.String("format", "gbx", `sheet format: "gbx" (GBX Tracker) or "dashboard" (Tender Dashboard)`)
		owner   = flag.String("owner", "sadmin", "bid owner: username, email or user UUID")
		dryRun  = flag.Bool("dry-run", true, "parse and report without writing; pass -dry-run=false to commit")
		report  = flag.String("report", "", "optional path to write the per-row report as CSV")
		verbose = flag.Bool("v", false, "print every row, not just warnings")
	)
	flag.Parse()

	if *file == "" {
		fmt.Fprintln(os.Stderr, "error: -file is required")
		flag.Usage()
		os.Exit(2)
	}
	if *format != "gbx" && *format != "dashboard" {
		fmt.Fprintln(os.Stderr, `error: -format must be "gbx" or "dashboard"`)
		os.Exit(2)
	}

	var preview *importer.Preview
	var err error
	if *format == "dashboard" {
		preview, err = importer.ParseWorkbookDashboard(*file)
	} else {
		preview, err = importer.ParseWorkbook(*file)
	}
	if err != nil {
		log.Fatalf("parse workbook: %v", err)
	}

	// Check identifiers against the database so a dry run shows exactly which
	// rows will be skipped. If the database is unreachable, fall back to
	// checking the sheet against itself and say so.
	ctx := context.Background()
	conn, connErr := connect(ctx)
	if connErr != nil {
		fmt.Printf("WARNING: could not reach the database (%v)\n", connErr)
		fmt.Println("         Duplicate check limited to this sheet only.")
		if err := importer.MarkDuplicates(ctx, nil, preview); err != nil {
			log.Fatalf("duplicate check: %v", err)
		}
	} else {
		defer conn.Close(ctx)
		if err := importer.MarkDuplicates(ctx, conn, preview); err != nil {
			log.Fatalf("duplicate check: %v", err)
		}
	}

	printSummary(preview, *verbose)

	if len(preview.SkippedSheets) > 0 {
		fmt.Println("\nSheets present but not imported:")
		for _, s := range preview.SkippedSheets {
			fmt.Printf("  %-20s %d rows\n", s.Name, s.Rows)
		}
	}

	if *report != "" {
		if err := writeReport(*report, preview.Bids); err != nil {
			log.Fatalf("write report: %v", err)
		}
		fmt.Printf("\nReport written to %s\n", *report)
	}

	if *dryRun {
		fmt.Printf("\nDRY RUN - nothing was written. Re-run with -dry-run=false to commit %d tenders.\n", preview.ImportCount)
		return
	}
	if connErr != nil {
		log.Fatalf("cannot commit without a database connection: %v", connErr)
	}

	if err := commit(ctx, conn, preview, *owner, *file); err != nil {
		log.Fatalf("import failed (rolled back): %v", err)
	}
	fmt.Printf("\nImported %d tenders successfully (%d skipped).\n", preview.ImportCount, len(preview.Skipped))
}

// ---------------------------------------------------------------- reporting

func printSummary(p *importer.Preview, verbose bool) {
	fmt.Printf("Parsed %d rows\n\n", len(p.Bids))

	fmt.Println("Derived workflow stage:")
	all := append(append([]string{}, domain.OrderedWorkflowStages...),
		domain.StageWon, domain.StageLost, domain.StageCancelled)
	for _, s := range all {
		if n := p.StageCounts[s]; n > 0 {
			fmt.Printf("  %5d  %s\n", n, s)
		}
	}

	statusCount := map[string]int{}
	for _, b := range p.Bids {
		if b.Skip {
			continue
		}
		statusCount[b.BidStatus]++
	}
	fmt.Println("\nBid status:")
	keys := make([]string, 0, len(statusCount))
	for k := range statusCount {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		fmt.Printf("  %5d  %s\n", statusCount[k], k)
	}

	if verbose {
		fmt.Println("\nRows:")
		for _, b := range p.Bids {
			fmt.Printf("  r%-4d %-32s %-40.40s %s\n", b.RowNum, b.WorkflowStage, b.Title, b.DerivationReason)
		}
	}

	if len(p.Duplicates) > 0 {
		fmt.Printf("\nPossible duplicates: %d\n", len(p.Duplicates))
		for _, d := range p.Duplicates {
			fmt.Printf("  rows %v share bid id + client + scope (%s)\n", d.Rows, d.BidID)
		}
	}

	if len(p.Skipped) > 0 {
		fmt.Printf("\nSkipped as already present: %d\n", len(p.Skipped))
		for _, sk := range p.Skipped {
			fmt.Printf("  r%-4d %-34s %s\n", sk.Row, sk.BidID, sk.Reason)
		}
	}

	fmt.Printf("\nWill import: %d of %d rows\n", p.ImportCount, len(p.Bids))

	fmt.Printf("\nRows needing review: %d\n", p.WarningRows)
	for _, b := range p.Bids {
		for _, w := range b.Warnings {
			fmt.Printf("  r%-4d %s\n", b.RowNum, w)
		}
	}
}

func writeReport(path string, bids []*importer.ImportedBid) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	w := csv.NewWriter(f)
	defer w.Flush()

	if err := w.Write([]string{
		"row", "bid_id", "client", "title", "workflow_stage", "bid_status",
		"reason", "target_month", "start_date", "end_date",
		"emd_amount", "bg_rate", "final_price", "estimated_value",
		"stages_complete", "warnings",
	}); err != nil {
		return err
	}
	for _, b := range bids {
		id := deref(b.GemBidNo)
		if id == "" {
			id = deref(b.BidNo)
		}
		complete := 0
		for _, s := range domain.OrderedWorkflowStages {
			if b.StageCompletions[s] {
				complete++
			}
		}
		if err := w.Write([]string{
			strconv.Itoa(b.RowNum), id, deref(b.OrganizationName), b.Title,
			b.WorkflowStage, b.BidStatus, b.DerivationReason,
			fmtDate(b.TargetMonthDate), fmtDate(b.StartDate), fmtDate(b.EndDate),
			fmtNum(b.EMDAmount), fmtNum(b.BGRate), fmtNum(b.FinalPrice), fmtNum(b.EstimatedValue),
			strconv.Itoa(complete), strings.Join(b.Warnings, "; "),
		}); err != nil {
			return err
		}
	}
	return nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func fmtDate(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02")
}

func fmtNum(f *float64) string {
	if f == nil {
		return ""
	}
	return strconv.FormatFloat(*f, 'f', -1, 64)
}

// ---------------------------------------------------------------- commit

func connect(ctx context.Context) (*pgx.Conn, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5432"),
		getEnv("DB_USER", "postgres"),
		getEnv("DB_PASSWORD", "postgres"),
		getEnv("DB_NAME", "onetrack"),
		getEnv("DB_SSLMODE", "disable"),
	)
	return pgx.Connect(ctx, dsn)
}

func commit(ctx context.Context, conn *pgx.Conn, preview *importer.Preview, owner, srcFile string) error {
	ownerID, err := importer.ResolveOwner(ctx, conn, owner)
	if err != nil {
		return err
	}
	fmt.Printf("\nOwner resolved to %s\n", ownerID)

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx)

	// Cross-file duplicates: fill in any field an already-existing tender is
	// missing, from a row that would otherwise just be skipped.
	if err := importer.EnrichDuplicates(ctx, tx, preview); err != nil {
		return err
	}

	if _, err := importer.InsertAll(ctx, tx, preview.Bids, ownerID, srcFile); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
