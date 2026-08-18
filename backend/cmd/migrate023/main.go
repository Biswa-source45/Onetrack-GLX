package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("../../.env")

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5433"),
		getEnv("DB_USER", "postgres"),
		getEnv("DB_PASSWORD", "postgres"),
		getEnv("DB_NAME", "onetrack"),
		getEnv("DB_SSLMODE", "disable"),
	)

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	sql := `
ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS emd_bank_name       TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_account_number  TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_ifsc_code       TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_branch          TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_beneficiary     TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS emd_payable_at      TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_bids_emd_type ON bid.bid_workspaces(emd_type) WHERE emd_type IS NOT NULL;

-- Mark migration as applied
INSERT INTO public.onetrack_migrations (version) 
VALUES ('000023_add_emd_bank_details')
ON CONFLICT DO NOTHING;
`
	_, err = pool.Exec(ctx, sql)
	if err != nil {
		log.Fatalf("migration failed: %v", err)
	}
	log.Println("Migration 000023 applied successfully!")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
