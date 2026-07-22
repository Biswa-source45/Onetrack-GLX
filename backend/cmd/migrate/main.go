package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	direction := "up"
	if len(os.Args) > 1 {
		direction = os.Args[1]
	}
	if direction != "up" && direction != "down" {
		log.Fatalf("Usage: migrate [up|down]")
	}

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5432"),
		getEnv("DB_USER", "postgres"),
		getEnv("DB_PASSWORD", "postgres"),
		getEnv("DB_NAME", "onetrack"),
		getEnv("DB_SSLMODE", "disable"),
	)

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer conn.Close(ctx)

	// Use a separate tracking table — avoids conflict with golang-migrate's schema_migrations (bigint version)
	_, err = conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS public.onetrack_migrations (
			version    VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create tracking table: %v", err)
	}

	// Seed already-applied migrations from golang-migrate's table so we don't re-run them.
	// golang-migrate stores the numeric prefix as version (e.g. 1, 2, 3).
	// We map those to our full version strings by listing migration files and cross-referencing.
	seedAppliedMigrations(ctx, conn)

	// Discover migration files
	pattern := fmt.Sprintf("migrations/*.%s.sql", direction)
	files, err := filepath.Glob(pattern)
	if err != nil || len(files) == 0 {
		log.Fatalf("No migration files found matching: %s", pattern)
	}
	sort.Strings(files)

	if direction == "down" {
		// Run down migrations in reverse order
		for i, j := 0, len(files)-1; i < j; i, j = i+1, j-1 {
			files[i], files[j] = files[j], files[i]
		}
	}

	applied := 0
	for _, file := range files {
		version := extractVersion(file)

		if direction == "up" {
			// Skip already applied migrations
			var exists bool
			err := conn.QueryRow(ctx,
				"SELECT EXISTS(SELECT 1 FROM public.onetrack_migrations WHERE version = $1)", version,
			).Scan(&exists)
			if err != nil {
				log.Fatalf("Failed to check migration status: %v", err)
			}
			if exists {
				log.Printf("  [SKIP] %s (already applied)", version)
				continue
			}
		}

		// Read and execute SQL file
		content, err := os.ReadFile(file)
		if err != nil {
			log.Fatalf("Failed to read %s: %v", file, err)
		}

		log.Printf("  [RUN]  %s ...", filepath.Base(file))

		_, err = conn.Exec(ctx, string(content))
		if err != nil {
			log.Fatalf("Failed to execute %s: %v", file, err)
		}

		if direction == "up" {
			_, err = conn.Exec(ctx,
				"INSERT INTO public.onetrack_migrations (version) VALUES ($1)", version)
			if err != nil {
				log.Fatalf("Failed to record migration %s: %v", version, err)
			}
		} else {
			_, err = conn.Exec(ctx,
				"DELETE FROM public.onetrack_migrations WHERE version = $1", version)
			if err != nil {
				log.Fatalf("Failed to remove migration record %s: %v", version, err)
			}
		}

		log.Printf("  [OK]   %s", filepath.Base(file))
		applied++
	}

	if applied == 0 {
		log.Println("No new migrations to apply.")
	} else {
		log.Printf("Done. Applied %d migration(s).", applied)
	}
}

// extractVersion parses "migrations/000004_create_bid_schema.up.sql" → "000004_create_bid_schema"
func extractVersion(path string) string {
	base := filepath.Base(path)
	base = strings.TrimSuffix(base, ".up.sql")
	base = strings.TrimSuffix(base, ".down.sql")
	return base
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}

// seedAppliedMigrations detects already-applied migrations by checking if the DB objects
// they create already exist, then marks them in onetrack_migrations so they are skipped.
// This works regardless of which migration tool was used previously.
func seedAppliedMigrations(ctx context.Context, conn *pgx.Conn) {
	// Map of version string → existence check query
	// Each query returns true if the migration was already applied.
	checks := map[string]string{
		"000001_create_auth_schema": `SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'auth' AND table_name = 'users'
		)`,
		"000002_seed_auth_data": `SELECT EXISTS (
			SELECT 1 FROM auth.roles WHERE name = 'SUPER_ADMIN'
		)`,
		"000003_add_user_profile_fields": `SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'full_name'
		)`,
	}

	for version, query := range checks {
		var applied bool
		_ = conn.QueryRow(ctx, query).Scan(&applied)
		if applied {
			_, _ = conn.Exec(ctx,
				"INSERT INTO public.onetrack_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
				version,
			)
			log.Printf("  [MARK] %s (already in DB)", version)
		}
	}
}
