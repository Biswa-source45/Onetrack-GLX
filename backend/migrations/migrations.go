package migrations

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed *.up.sql
var MigrationFS embed.FS

func RunAutoMigrations(ctx context.Context, db *pgxpool.Pool) error {
	// Create tracking table if not exists
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS public.onetrack_migrations (
			version    VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create migration tracking table: %w", err)
	}

	entries, err := MigrationFS.ReadDir(".")
	if err != nil {
		return fmt.Errorf("failed to read embedded migrations: %w", err)
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			files = append(files, entry.Name())
		}
	}
	sort.Strings(files)

	for _, file := range files {
		version := strings.TrimSuffix(file, ".up.sql")

		var exists bool
		err := db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM public.onetrack_migrations WHERE version = $1)", version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check migration status for %s: %w", version, err)
		}
		if exists {
			continue
		}

		content, err := MigrationFS.ReadFile(file)
		if err != nil {
			return fmt.Errorf("failed to read embedded migration file %s: %w", file, err)
		}

		log.Printf("[AutoMigrate] Executing %s ...", file)
		_, err = db.Exec(ctx, string(content))
		if err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", file, err)
		}

		_, err = db.Exec(ctx, "INSERT INTO public.onetrack_migrations (version) VALUES ($1)", version)
		if err != nil {
			return fmt.Errorf("failed to record migration %s: %w", version, err)
		}

		log.Printf("[AutoMigrate] Successfully applied %s", file)
	}

	// Always ensure default admin user exists and password hash is set
	EnsureDefaultAdmin(ctx, db)

	return nil
}

func EnsureDefaultAdmin(ctx context.Context, db *pgxpool.Pool) {
	// bcrypt hash of 'Admin@123'
	adminHash := "$2a$12$t8z9b7lU.qbkEwxUeHxTBuLp7JqL0Na1bsh5Qys0HI6B5BYXpPoLK"
	
	query := `
		INSERT INTO auth.users (employee_code, username, password_hash, force_password_change, is_active)
		VALUES ('ADMIN001', 'admin', $1, true, true)
		ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_active = true;
	`
	_, err := db.Exec(ctx, query, adminHash)
	if err != nil {
		log.Printf("[AutoMigrate] Notice seeding admin user: %v", err)
		return
	}

	// Ensure SUPER_ADMIN role assignment
	roleQuery := `
		INSERT INTO auth.user_roles (user_id, role_id)
		SELECT u.id, r.id FROM auth.users u, auth.roles r
		WHERE u.username = 'admin' AND r.name = 'SUPER_ADMIN'
		ON CONFLICT DO NOTHING;
	`
	_, _ = db.Exec(ctx, roleQuery)
	log.Println("[AutoMigrate] Verified default super admin account 'admin' with password 'Admin@123'")
}
