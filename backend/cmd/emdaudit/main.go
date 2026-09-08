// emdaudit is a read-only diagnostic — NOT part of the app, not wired into
// any build, never committed. It exists only to answer: for bulk-imported
// tenders, what does emd_returned currently look like, and how does that
// compare to what a "closed" tender should carry.
//
// Run: go run ./cmd/emdaudit
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	_ = godotenv.Load()
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		env("DB_HOST", "localhost"), env("DB_PORT", "5433"), env("DB_USER", "postgres"),
		env("DB_PASSWORD", "postgres"), env("DB_NAME", "onetrack"), env("DB_SSLMODE", "disable"))

	conn, err := pgx.Connect(context.Background(), dsn)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close(context.Background())
	ctx := context.Background()

	fmt.Println("=== 1. Overall split: imported vs manual ===")
	rows, err := conn.Query(ctx, `
		SELECT
			COALESCE(metadata->>'imported', 'false') = 'true' AS is_imported,
			bid_status,
			count(*),
			COALESCE(sum(COALESCE(emd_amount,0)) FILTER (WHERE emd_returned = false AND emd_exempted = false AND emd_not_applicable = false), 0) AS outstanding_sum,
			COALESCE(sum(COALESCE(emd_amount,0)) FILTER (WHERE emd_returned = true), 0) AS returned_sum,
			count(*) FILTER (WHERE emd_returned = true) AS returned_count
		FROM bid.bid_workspaces
		WHERE archived_at IS NULL
		GROUP BY 1,2
		ORDER BY 1,2`)
	if err != nil {
		log.Fatalf("query1: %v", err)
	}
	for rows.Next() {
		var isImported bool
		var status string
		var cnt, returnedCount int
		var outstanding, returned float64
		if err := rows.Scan(&isImported, &status, &cnt, &outstanding, &returned, &returnedCount); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("imported=%-5v status=%-12s count=%-4d outstanding_sum=%.2f returned_sum=%.2f returned_count=%d\n",
			isImported, status, cnt, outstanding, returned, returnedCount)
	}
	rows.Close()

	fmt.Println("\n=== 2. emd_returned distribution among IMPORTED bids only ===")
	rows, err = conn.Query(ctx, `
		SELECT emd_returned, emd_exempted, emd_not_applicable, count(*), sum(COALESCE(emd_amount,0))
		FROM bid.bid_workspaces
		WHERE archived_at IS NULL AND metadata->>'imported' = 'true'
		GROUP BY 1,2,3
		ORDER BY 1,2,3`)
	if err != nil {
		log.Fatalf("query2: %v", err)
	}
	for rows.Next() {
		var returned, exempted, notApplicable bool
		var cnt int
		var sum float64
		if err := rows.Scan(&returned, &exempted, &notApplicable, &cnt, &sum); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("emd_returned=%-5v exempted=%-5v not_applicable=%-5v count=%-4d sum=%.2f\n", returned, exempted, notApplicable, cnt, sum)
	}
	rows.Close()

	fmt.Println("\n=== 3. The 9 sample Bid IDs from the reference table — current stored state ===")
	sampleIDs := []string{
		"GEM/2025/B/6935931", "GEM/2026/B/7206177", "GEM/2026/B/7139304",
		"GEM/2026/B/7268770", "GEM/2026/B/7327401", "GEM/2026/B/7360277",
		"GEM/2026/B/7392098", "GEM/2026/B/7472152", "GEM/2026/B/7791470",
	}
	for _, id := range sampleIDs {
		row := conn.QueryRow(ctx, `
			SELECT gem_bid_no, bid_no, organization_name, bid_status, workflow_stage,
			       excel_bid_status, emd_amount, emd_returned, emd_returned_date,
			       emd_exempted, emd_not_applicable, metadata->>'imported'
			FROM bid.bid_workspaces
			WHERE archived_at IS NULL AND (UPPER(TRIM(gem_bid_no)) = UPPER($1) OR UPPER(TRIM(bid_no)) = UPPER($1))
			LIMIT 1`, id)
		var gemBidNo, bidNo, org, bidStatus, workflowStage, excelStatus, imported *string
		var emdAmount *float64
		var emdReturned, emdExempted, emdNotApplicable *bool
		var emdReturnedDate *string
		err := row.Scan(&gemBidNo, &bidNo, &org, &bidStatus, &workflowStage, &excelStatus, &emdAmount, &emdReturned, &emdReturnedDate, &emdExempted, &emdNotApplicable, &imported)
		if err != nil {
			fmt.Printf("%-22s NOT FOUND (%v)\n", id, err)
			continue
		}
		fmt.Printf("%-22s org=%-45s bid_status=%-10s workflow=%-14s excel_status=%-10s emd_amount=%-10v emd_returned=%-5v exempted=%-5v not_applicable=%-5v imported=%v\n",
			id, strOr(org), strOr(bidStatus), strOr(workflowStage), strOr(excelStatus), fmtF(emdAmount), boolOr(emdReturned), boolOr(emdExempted), boolOr(emdNotApplicable), strOr(imported))
	}

	fmt.Println("\n=== 4. Distinct bid_status / excel_bid_status / workflow_stage values seen on IMPORTED bids ===")
	rows, err = conn.Query(ctx, `
		SELECT bid_status, excel_bid_status, workflow_stage, count(*)
		FROM bid.bid_workspaces
		WHERE archived_at IS NULL AND metadata->>'imported' = 'true'
		GROUP BY 1,2,3
		ORDER BY 4 DESC`)
	if err != nil {
		log.Fatalf("query4: %v", err)
	}
	for rows.Next() {
		var bidStatus, excelStatus, workflow *string
		var cnt int
		if err := rows.Scan(&bidStatus, &excelStatus, &workflow, &cnt); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("bid_status=%-12s excel_bid_status=%-14s workflow_stage=%-28s count=%d\n", strOr(bidStatus), strOr(excelStatus), strOr(workflow), cnt)
	}
	rows.Close()
}

func strOr(s *string) string {
	if s == nil {
		return "-"
	}
	return *s
}
func boolOr(b *bool) string {
	if b == nil {
		return "-"
	}
	if *b {
		return "true"
	}
	return "false"
}
func fmtF(f *float64) string {
	if f == nil {
		return "-"
	}
	return fmt.Sprintf("%.2f", *f)
}
