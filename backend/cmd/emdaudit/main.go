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

	fmt.Println("\n=== Tenders updated recently (last 7 days) ===")
	rows, err = conn.Query(ctx, `
		SELECT id, title, workflow_stage, bid_status, emd_amount, emd_ready, emd_returned,
		       emd_returned_date, updated_at
		FROM bid.bid_workspaces
		WHERE archived_at IS NULL
		ORDER BY updated_at DESC
		LIMIT 15`)
	if err != nil {
		log.Fatal(err)
	}
	for rows.Next() {
		var id, title, stage, status string
		var emdAmount *float64
		var emdReady, emdReturned bool
		var emdReturnedDate, updatedAt *string
		if err := rows.Scan(&id, &title, &stage, &status, &emdAmount, &emdReady, &emdReturned, &emdReturnedDate, &updatedAt); err != nil {
			log.Fatal(err)
		}
		amt := 0.0
		if emdAmount != nil {
			amt = *emdAmount
		}
		retD := "-"
		if emdReturnedDate != nil {
			retD = *emdReturnedDate
		}
		upD := "-"
		if updatedAt != nil {
			upD = *updatedAt
		}
		fmt.Printf("id=%s stage=%-22s status=%-6s amt=%-9.2f ready=%-5v ret=%-5v retDate=%-20s updated=%-20s title=%s\n",
			id[:8], stage, status, amt, emdReady, emdReturned, retD[:min(len(retD), 19)], upD[:min(len(upD), 19)], title)
	}
	rows.Close()

	fmt.Println("\n=== Active tenders requiring EMD ===")
	rows, err = conn.Query(ctx, `
		SELECT id, title, workflow_stage, bid_status, emd_amount, emd_ready, emd_returned,
		       COALESCE(closing_date::text, end_date::text, 'no date') AS deadline
		FROM bid.bid_workspaces
		WHERE archived_at IS NULL
		  AND workflow_stage NOT IN ('CANCELLED', 'CLOSED', 'LOST')
		  AND bid_status NOT IN ('CANCELLED', 'CLOSED', 'LOST')
		  AND COALESCE(bid_outcome, '') != 'LOST'
		  AND emd_exempted = false AND emd_not_applicable = false AND COALESCE(emd_amount, 0) > 0
		ORDER BY closing_date ASC NULLS LAST`)
	if err != nil {
		log.Fatal(err)
	}
	var totalPipeline float64
	var countPipeline int
	for rows.Next() {
		var id, title, stage, status, deadline string
		var emdAmount float64
		var emdReady, emdReturned bool
		if err := rows.Scan(&id, &title, &stage, &status, &emdAmount, &emdReady, &emdReturned, &deadline); err != nil {
			log.Fatal(err)
		}
		totalPipeline += emdAmount
		countPipeline++
		fmt.Printf("#%d id=%s stage=%-25s status=%-8s ready=%-5v ret=%-5v amt=%-10.2f deadline=%-25s title=%s\n",
			countPipeline, id[:8], stage, status, emdReady, emdReturned, emdAmount, deadline, title)
	}
	fmt.Printf("Total Pipeline: count=%d sum=%.2f\n", countPipeline, totalPipeline)
	rows.Close()

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
