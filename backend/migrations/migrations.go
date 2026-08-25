package migrations

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
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
	// Dynamically generate bcrypt hash for 'Admin@123'
	hashBytes, err := bcrypt.GenerateFromPassword([]byte("Admin@123"), bcrypt.DefaultCost)
	adminHash := string(hashBytes)
	if err != nil {
		adminHash = "$2a$10$nO1jIUku8kehdnwKrV2q4u9HKgspwcsX9hFts.OePRaTBOLoZnsXK"
	}

	// Operate on whichever row already matches case-insensitively (e.g. a
	// 'sadmin' created by a migration) rather than assuming a literal 'Sadmin'
	// row — an INSERT with ON CONFLICT (username) alone can't catch a
	// collision on the separate unique index on email when a differently-cased
	// row already owns it, which previously crash-looped the server the
	// instant a lowercase 'sadmin' row existed alongside this literal insert.
	tag, err := db.Exec(ctx, `
		UPDATE auth.users SET email = 'biswabhusans@globx.co.in', password_hash = $1, is_active = true
		WHERE LOWER(username) = 'sadmin'
	`, adminHash)
	if err != nil {
		log.Printf("[AutoMigrate] Notice seeding admin user: %v", err)
		return
	}
	if tag.RowsAffected() == 0 {
		_, err = db.Exec(ctx, `
			INSERT INTO auth.users (employee_code, username, email, password_hash, force_password_change, is_active)
			VALUES ('SUPERADMIN001', 'Sadmin', 'biswabhusans@globx.co.in', $1, false, true)
		`, adminHash)
		if err != nil {
			log.Printf("[AutoMigrate] Notice seeding admin user: %v", err)
			return
		}
	}

	// Also update password hash for seeded test users so Admin@123 works for them too
	_, _ = db.Exec(ctx, `UPDATE auth.users SET password_hash = $1 WHERE LOWER(username) IN ('sadmin', 'biswapvt', 'biswabhusan')`, adminHash)

	// Ensure SUPER_ADMIN role assignment
	roleQuery := `
		INSERT INTO auth.user_roles (user_id, role_id)
		SELECT u.id, r.id FROM auth.users u, auth.roles r
		WHERE LOWER(u.username) = 'sadmin' AND r.name = 'SUPER_ADMIN'
		ON CONFLICT DO NOTHING;
	`
	_, _ = db.Exec(ctx, roleQuery)
	log.Println("[AutoMigrate] Verified default super admin account 'Sadmin' (biswabhusans@globx.co.in) with password 'Admin@123'")
}
