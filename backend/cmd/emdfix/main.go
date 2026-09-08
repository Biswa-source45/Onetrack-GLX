// emdfix repairs the bulk-import EMD-returned data gap — NOT part of the app,
// not wired into any build, never committed or pushed.
//
// Root cause: backend/internal/bid/importer's INSERT never wrote
// emd_returned/emd_returned_date, so every bulk-imported row silently kept
// the column's DB default (false) forever, regardless of whether the
// procuring authority had actually sent the EMD back. In the normal
// (manually-tracked) flow, emd_returned is a human-confirmed fact ticked in
// the Award & Handover / EMD Return workspace once the authority actually
// refunds it — bulk import never went through that workspace, so it was
// never ticked for any imported row.
//
// This script applies that same human confirmation in bulk: for every
// bulk-imported tender that has reached a terminal state where EMD should
// already be settled (CLOSED, LOST, WON) and actually owed a real EMD (not
// exempted, not N/A), it marks emd_returned = true — EXCEPT the specific
// Bid IDs the procuring authority has confirmed are still outstanding
// (pendingBidIDs below), which are left untouched.
//
// CANCELLED tenders are deliberately left untouched and only reported —
// whether EMD was ever actually paid on a cancelled tender needs a human
// decision, not a guess.
//
// It also fixes one specific mismatch found during the audit: GEM/2025/B/6935931
// (Bangalore Metro) is stored as emd_exempted, but the reference table shows
// it as a normal EMD submission.
//
// Usage:
//
//	go run ./cmd/emdfix                 # dry run (default) — prints what would change, commits nothing
//	go run ./cmd/emdfix -apply          # actually applies the fix, in one transaction
//
// Same command works unchanged on another machine (e.g. the host/production
// box) — it reads DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSLMODE from
// that machine's own .env, exactly like the real server does. Always run
// without -apply first and read the printed list before adding -apply.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

// pendingBidIDs is the procuring-authority-confirmed "still outstanding" list
// (GeM Bid ID / RFP number, matched against gem_bid_no or bid_no the same
// case/whitespace-insensitive way the rest of the app matches identifiers).
// This is the COMPLETE list as of 2026-09-07 — every other bulk-imported
// CLOSED/LOST/WON tender is assumed already refunded.
var pendingBidIDs = []string{
	"GEM/2025/B/6935931", // Bangalore Metro — still ACTIVE, not in scope anyway, listed for completeness
	"GEM/2026/B/7206177", // Online Citizen Services Portal
	"GEM/2026/B/7139304", // IOCL — still ACTIVE, not in scope anyway
	"GEM/2026/B/7268770", // IIFT Delhi
	"GEM/2026/B/7327401", // Settlement Commissioner and Director of Land Records
	"GEM/2026/B/7360277", // SJVN Limited, Shimla — still ACTIVE, not in scope anyway
	"GEM/2026/B/7392098", // Irel India - CCTV (Prem)
	"GEM/2026/B/7472152", // NALCO Damanjodi - Boom Barrier (Prem)
	"GEM/2026/B/7791470", // IIM Bodh Gaya
}

// exemptionMismatchFix: bid IDs where emd_exempted must be cleared to false
// because the reference table shows a normal (non-exempt) EMD submission.
var exemptionMismatchFix = []string{
	"GEM/2025/B/6935931", // Bangalore Metro — ₹61,735, DD, not exempted per reference table
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type row struct {
	id, gemBidNo, bidNo, org, bidStatus string
	emdAmount                           float64
}

func main() {
	apply := flag.Bool("apply", false, "actually commit the fix (default: dry run, prints only)")
	flag.Parse()

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

	tx, err := conn.Begin(ctx)
	if err != nil {
		log.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback(ctx) // no-op after a successful Commit

	pendingUpper := make([]string, len(pendingBidIDs))
	for i, id := range pendingBidIDs {
		pendingUpper[i] = strings.ToUpper(strings.TrimSpace(id))
	}

	// 1. Rows that WOULD be marked emd_returned = true.
	toMark, err := queryRows(ctx, tx, `
		SELECT id, COALESCE(gem_bid_no,''), COALESCE(bid_no,''), COALESCE(organization_name,''), bid_status, COALESCE(emd_amount,0)
		FROM bid.bid_workspaces
		WHERE archived_at IS NULL
		  AND metadata->>'imported' = 'true'
		  AND bid_status IN ('CLOSED','LOST','WON')
		  AND emd_exempted = false
		  AND emd_not_applicable = false
		  AND emd_returned = false
		  AND UPPER(TRIM(COALESCE(gem_bid_no,''))) <> ALL($1)
		  AND UPPER(TRIM(COALESCE(bid_no,''))) <> ALL($1)
		ORDER BY organization_name`, pendingUpper)
	if err != nil {
		log.Fatalf("query toMark: %v", err)
	}

	// 2. Rows staying pending (the authority-confirmed exceptions), for the printout.
	stillPending, err := queryRows(ctx, tx, `
		SELECT id, COALESCE(gem_bid_no,''), COALESCE(bid_no,''), COALESCE(organization_name,''), bid_status, COALESCE(emd_amount,0)
		FROM bid.bid_workspaces
		WHERE archived_at IS NULL
		  AND metadata->>'imported' = 'true'
		  AND (UPPER(TRIM(COALESCE(gem_bid_no,''))) = ANY($1) OR UPPER(TRIM(COALESCE(bid_no,''))) = ANY($1))
		ORDER BY organization_name`, pendingUpper)
	if err != nil {
		log.Fatalf("query stillPending: %v", err)
	}

	// 3. CANCELLED — reported only, never touched.
	cancelled, err := queryRows(ctx, tx, `
		SELECT id, COALESCE(gem_bid_no,''), COALESCE(bid_no,''), COALESCE(organization_name,''), bid_status, COALESCE(emd_amount,0)
		FROM bid.bid_workspaces
		WHERE archived_at IS NULL
		  AND metadata->>'imported' = 'true'
		  AND bid_status = 'CANCELLED'
		  AND emd_exempted = false
		  AND emd_not_applicable = false
		ORDER BY organization_name`)
	if err != nil {
		log.Fatalf("query cancelled: %v", err)
	}

	printSection("WILL BE MARKED emd_returned = true", toMark)
	printSection("STAYING PENDING (authority-confirmed still outstanding — untouched)", stillPending)
	printSection("CANCELLED — NOT TOUCHED, needs your manual decision", cancelled)

	fmt.Printf("\nEmd-exemption-flag fix: %s\n", strings.Join(exemptionMismatchFix, ", "))

	if !*apply {
		fmt.Println("\n--- DRY RUN ONLY — nothing was written. Re-run with -apply to commit. ---")
		return
	}

	tag, err := tx.Exec(ctx, `
		UPDATE bid.bid_workspaces
		SET emd_returned = true
		WHERE archived_at IS NULL
		  AND metadata->>'imported' = 'true'
		  AND bid_status IN ('CLOSED','LOST','WON')
		  AND emd_exempted = false
		  AND emd_not_applicable = false
		  AND emd_returned = false
		  AND UPPER(TRIM(COALESCE(gem_bid_no,''))) <> ALL($1)
		  AND UPPER(TRIM(COALESCE(bid_no,''))) <> ALL($1)`, pendingUpper)
	if err != nil {
		log.Fatalf("update emd_returned: %v", err)
	}
	fmt.Printf("\nRows updated (emd_returned -> true): %d\n", tag.RowsAffected())

	for _, id := range exemptionMismatchFix {
		upperID := strings.ToUpper(strings.TrimSpace(id))
		tag, err := tx.Exec(ctx, `
			UPDATE bid.bid_workspaces
			SET emd_exempted = false
			WHERE archived_at IS NULL AND metadata->>'imported' = 'true'
			  AND (UPPER(TRIM(COALESCE(gem_bid_no,''))) = $1 OR UPPER(TRIM(COALESCE(bid_no,''))) = $1)`, upperID)
		if err != nil {
			log.Fatalf("update emd_exempted for %s: %v", id, err)
		}
		fmt.Printf("Rows updated (emd_exempted -> false) for %s: %d\n", id, tag.RowsAffected())
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("commit: %v", err)
	}
	fmt.Println("\n--- APPLIED AND COMMITTED ---")
}

func queryRows(ctx context.Context, tx pgx.Tx, sql string, args ...interface{}) ([]row, error) {
	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.gemBidNo, &r.bidNo, &r.org, &r.bidStatus, &r.emdAmount); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func printSection(title string, rows []row) {
	fmt.Printf("\n=== %s (%d rows) ===\n", title, len(rows))
	total := 0.0
	ids := make([]string, 0, len(rows))
	for _, r := range rows {
		identifier := r.gemBidNo
		if identifier == "" {
			identifier = r.bidNo
		}
		fmt.Printf("%-22s %-45s status=%-10s amount=%.2f\n", identifier, truncate(r.org, 45), r.bidStatus, r.emdAmount)
		total += r.emdAmount
		ids = append(ids, identifier)
	}
	sort.Strings(ids)
	fmt.Printf("--- total: %.2f ---\n", total)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}
