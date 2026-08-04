package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/auth/domain"
)

type postgresAuthRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresAuthRepository(pool *pgxpool.Pool) domain.AuthRepository {
	return &postgresAuthRepo{pool: pool}
}

func (r *postgresAuthRepo) GetUserByUsername(ctx context.Context, username string) (*domain.User, error) {
	query := `
		SELECT id, employee_code, username, full_name, email, phone, department,
		       password_hash, force_password_change, is_active, last_login_at, created_at, updated_at
		FROM auth.users
		WHERE LOWER(username) = LOWER($1) OR (email IS NOT NULL AND LOWER(email) = LOWER($1))
	`

	var user domain.User
	err := r.pool.QueryRow(ctx, query, username).Scan(
		&user.ID,
		&user.EmployeeCode,
		&user.Username,
		&user.FullName,
		&user.Email,
		&user.Phone,
		&user.Department,
		&user.PasswordHash,
		&user.ForcePasswordChange,
		&user.IsActive,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return &user, nil
}

func (r *postgresAuthRepo) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	query := `
		SELECT id, employee_code, username, full_name, email, phone, department,
		       password_hash, force_password_change, is_active, last_login_at, created_at, updated_at
		FROM auth.users
		WHERE id = $1
	`

	var user domain.User
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.EmployeeCode,
		&user.Username,
		&user.FullName,
		&user.Email,
		&user.Phone,
		&user.Department,
		&user.PasswordHash,
		&user.ForcePasswordChange,
		&user.IsActive,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return &user, nil
}

func (r *postgresAuthRepo) UpdateLastLogin(ctx context.Context, userID string) error {
	query := `UPDATE auth.users SET last_login_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, userID)
	return err
}

func (r *postgresAuthRepo) UpdatePassword(ctx context.Context, userID string, passwordHash string) error {
	query := `UPDATE auth.users SET password_hash = $1, force_password_change = false WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, passwordHash, userID)
	return err
}

func (r *postgresAuthRepo) SetForcePasswordChange(ctx context.Context, userID string, force bool) error {
	query := `UPDATE auth.users SET force_password_change = $1 WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, force, userID)
	return err
}

func (r *postgresAuthRepo) GetUserRoles(ctx context.Context, userID string) ([]domain.Role, error) {
	query := `
		SELECT r.id, r.name, r.description, r.is_system
		FROM auth.roles r
		INNER JOIN auth.user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role.ID, &role.Name, &role.Description, &role.IsSystem); err != nil {
			return nil, fmt.Errorf("failed to scan role: %w", err)
		}
		roles = append(roles, role)
	}

	return roles, nil
}

func (r *postgresAuthRepo) GetUserPermissions(ctx context.Context, userID string) ([]string, error) {
	query := `
		SELECT DISTINCT p.resource || '.' || p.action AS permission
		FROM auth.permissions p
		INNER JOIN auth.role_permissions rp ON rp.permission_id = p.id
		INNER JOIN auth.user_roles ur ON ur.role_id = rp.role_id
		WHERE ur.user_id = $1
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}
	defer rows.Close()

	var permissions []string
	for rows.Next() {
		var perm string
		if err := rows.Scan(&perm); err != nil {
			return nil, fmt.Errorf("failed to scan permission: %w", err)
		}
		permissions = append(permissions, perm)
	}

	// Apply overrides
	overrides, err := r.GetPermissionOverrides(ctx, userID)
	if err != nil {
		return permissions, nil
	}

	// Build override maps
	allowOverrides := make(map[string]bool)
	denyOverrides := make(map[string]bool)

	for _, override := range overrides {
		// Fetch the permission string for this override
		var permStr string
		permQuery := `SELECT resource || '.' || action FROM auth.permissions WHERE id = $1`
		err := r.pool.QueryRow(ctx, permQuery, override.PermissionID).Scan(&permStr)
		if err != nil {
			continue
		}
		if override.Effect == "ALLOW" {
			allowOverrides[permStr] = true
		} else if override.Effect == "DENY" {
			denyOverrides[permStr] = true
		}
	}

	// Remove denied permissions
	filtered := make([]string, 0, len(permissions))
	for _, p := range permissions {
		if !denyOverrides[p] {
			filtered = append(filtered, p)
		}
	}

	// Add allowed overrides not already present
	permSet := make(map[string]bool)
	for _, p := range filtered {
		permSet[p] = true
	}
	for perm := range allowOverrides {
		if !permSet[perm] {
			filtered = append(filtered, perm)
		}
	}

	return filtered, nil
}

func (r *postgresAuthRepo) GetPermissionOverrides(ctx context.Context, userID string) ([]domain.UserPermissionOverride, error) {
	query := `
		SELECT id, user_id, permission_id, effect
		FROM auth.user_permission_overrides
		WHERE user_id = $1
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get permission overrides: %w", err)
	}
	defer rows.Close()

	var overrides []domain.UserPermissionOverride
	for rows.Next() {
		var o domain.UserPermissionOverride
		if err := rows.Scan(&o.ID, &o.UserID, &o.PermissionID, &o.Effect); err != nil {
			return nil, fmt.Errorf("failed to scan override: %w", err)
		}
		overrides = append(overrides, o)
	}

	return overrides, nil
}

func (r *postgresAuthRepo) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT id, employee_code, username, full_name, email, phone, department,
		       password_hash, force_password_change, is_active, last_login_at, created_at, updated_at
		FROM auth.users
		WHERE LOWER(email) = LOWER($1)
	`

	var user domain.User
	err := r.pool.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.EmployeeCode,
		&user.Username,
		&user.FullName,
		&user.Email,
		&user.Phone,
		&user.Department,
		&user.PasswordHash,
		&user.ForcePasswordChange,
		&user.IsActive,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found by email: %w", err)
	}

	return &user, nil
}

func (r *postgresAuthRepo) CreateOTP(ctx context.Context, email, otp string) error {
	// Clean previous OTPs for this email
	_, _ = r.pool.Exec(ctx, `DELETE FROM auth.password_otps WHERE LOWER(email) = LOWER($1)`, email)

	query := `
		INSERT INTO auth.password_otps (email, otp_code, expires_at)
		VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
	`
	_, err := r.pool.Exec(ctx, query, email, otp)
	return err
}

func (r *postgresAuthRepo) VerifyOTP(ctx context.Context, email, otp string) (bool, error) {
	query := `
		SELECT COUNT(1)
		FROM auth.password_otps
		WHERE LOWER(email) = LOWER($1) AND otp_code = $2 AND expires_at > NOW()
	`
	var count int
	err := r.pool.QueryRow(ctx, query, email, otp).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *postgresAuthRepo) DeleteOTP(ctx context.Context, email string) error {
	query := `DELETE FROM auth.password_otps WHERE LOWER(email) = LOWER($1)`
	_, err := r.pool.Exec(ctx, query, email)
	return err
}
