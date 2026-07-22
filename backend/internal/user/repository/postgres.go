package repository

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	authDomain "github.com/onetrack/backend/internal/auth/domain"
	"github.com/onetrack/backend/internal/user/domain"
)

type postgresUserRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresUserRepository(pool *pgxpool.Pool) domain.UserRepository {
	return &postgresUserRepo{pool: pool}
}

func (r *postgresUserRepo) Create(ctx context.Context, user *authDomain.User, passwordHash string) (string, error) {
	query := `
		INSERT INTO auth.users (employee_code, username, full_name, email, phone, department, password_hash, force_password_change, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
		RETURNING id
	`

	var id string
	err := r.pool.QueryRow(ctx, query,
		user.EmployeeCode,
		user.Username,
		user.FullName,
		user.Email,
		user.Phone,
		user.Department,
		passwordHash,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("failed to create user: %w", err)
	}

	return id, nil
}

func (r *postgresUserRepo) GetByID(ctx context.Context, id string) (*authDomain.User, error) {
	query := `
		SELECT id, employee_code, username, full_name, email, phone, department,
		       password_hash, force_password_change, is_active, last_login_at, created_at, updated_at
		FROM auth.users
		WHERE id = $1
	`

	var user authDomain.User
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

func (r *postgresUserRepo) List(ctx context.Context, params domain.ListUsersParams) ([]authDomain.User, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if params.Search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(username ILIKE $%d OR full_name ILIKE $%d OR employee_code ILIKE $%d)",
			argIdx, argIdx, argIdx,
		))
		args = append(args, "%"+params.Search+"%")
		argIdx++
	}

	if params.IsActive != nil {
		conditions = append(conditions, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *params.IsActive)
		argIdx++
	}

	if params.Department != "" {
		conditions = append(conditions, fmt.Sprintf("department = $%d", argIdx))
		args = append(args, params.Department)
		argIdx++
	}

	if params.Role != "" {
		conditions = append(conditions, fmt.Sprintf(
			"id IN (SELECT ur.user_id FROM auth.user_roles ur INNER JOIN auth.roles r ON r.id = ur.role_id WHERE r.name = $%d)",
			argIdx,
		))
		args = append(args, params.Role)
		argIdx++
	}

	whereClause := strings.Join(conditions, " AND ")

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM auth.users WHERE %s", whereClause)
	var total int
	err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	// Paginated query
	offset := (params.Page - 1) * params.Limit
	listQuery := fmt.Sprintf(`
		SELECT id, employee_code, username, full_name, email, phone, department,
		       password_hash, force_password_change, is_active, last_login_at, created_at, updated_at
		FROM auth.users
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, params.Limit, offset)

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []authDomain.User
	for rows.Next() {
		var user authDomain.User
		if err := rows.Scan(
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
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	return users, total, nil
}

func (r *postgresUserRepo) Update(ctx context.Context, id string, req domain.UpdateUserRequest) error {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.FullName != nil {
		setClauses = append(setClauses, fmt.Sprintf("full_name = $%d", argIdx))
		args = append(args, *req.FullName)
		argIdx++
	}
	if req.Email != nil {
		setClauses = append(setClauses, fmt.Sprintf("email = $%d", argIdx))
		args = append(args, *req.Email)
		argIdx++
	}
	if req.Phone != nil {
		setClauses = append(setClauses, fmt.Sprintf("phone = $%d", argIdx))
		args = append(args, *req.Phone)
		argIdx++
	}
	if req.Department != nil {
		setClauses = append(setClauses, fmt.Sprintf("department = $%d", argIdx))
		args = append(args, *req.Department)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil
	}

	query := fmt.Sprintf("UPDATE auth.users SET %s WHERE id = $%d",
		strings.Join(setClauses, ", "), argIdx)
	args = append(args, id)

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}

func (r *postgresUserRepo) UpdateStatus(ctx context.Context, id string, isActive bool) error {
	query := `UPDATE auth.users SET is_active = $1 WHERE id = $2`
	result, err := r.pool.Exec(ctx, query, isActive, id)
	if err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (r *postgresUserRepo) AssignRoles(ctx context.Context, userID string, roleNames []string, assignedBy string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Remove existing roles
	_, err = tx.Exec(ctx, "DELETE FROM auth.user_roles WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("failed to clear existing roles: %w", err)
	}

	// Insert new roles
	for _, roleName := range roleNames {
		query := `
			INSERT INTO auth.user_roles (user_id, role_id, assigned_by)
			SELECT $1, r.id, $3
			FROM auth.roles r
			WHERE r.name = $2
		`
		result, err := tx.Exec(ctx, query, userID, roleName, assignedBy)
		if err != nil {
			return fmt.Errorf("failed to assign role %s: %w", roleName, err)
		}
		if result.RowsAffected() == 0 {
			return fmt.Errorf("role not found: %s", roleName)
		}
	}

	return tx.Commit(ctx)
}

func (r *postgresUserRepo) SetPermissionOverrides(ctx context.Context, userID string, allow []string, deny []string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Remove existing overrides
	_, err = tx.Exec(ctx, "DELETE FROM auth.user_permission_overrides WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("failed to clear existing overrides: %w", err)
	}

	// Insert ALLOW overrides
	for _, perm := range allow {
		parts := strings.SplitN(perm, ".", 2)
		if len(parts) != 2 {
			return fmt.Errorf("invalid permission format: %s (expected resource.action)", perm)
		}
		query := `
			INSERT INTO auth.user_permission_overrides (user_id, permission_id, effect)
			SELECT $1, p.id, 'ALLOW'
			FROM auth.permissions p
			WHERE p.resource = $2 AND p.action = $3
		`
		result, err := tx.Exec(ctx, query, userID, parts[0], parts[1])
		if err != nil {
			return fmt.Errorf("failed to set ALLOW override for %s: %w", perm, err)
		}
		if result.RowsAffected() == 0 {
			return fmt.Errorf("permission not found: %s", perm)
		}
	}

	// Insert DENY overrides
	for _, perm := range deny {
		parts := strings.SplitN(perm, ".", 2)
		if len(parts) != 2 {
			return fmt.Errorf("invalid permission format: %s (expected resource.action)", perm)
		}
		query := `
			INSERT INTO auth.user_permission_overrides (user_id, permission_id, effect)
			SELECT $1, p.id, 'DENY'
			FROM auth.permissions p
			WHERE p.resource = $2 AND p.action = $3
		`
		result, err := tx.Exec(ctx, query, userID, parts[0], parts[1])
		if err != nil {
			return fmt.Errorf("failed to set DENY override for %s: %w", perm, err)
		}
		if result.RowsAffected() == 0 {
			return fmt.Errorf("permission not found: %s", perm)
		}
	}

	return tx.Commit(ctx)
}

func (r *postgresUserRepo) GetRolesByUserID(ctx context.Context, userID string) ([]string, error) {
	query := `
		SELECT r.name
		FROM auth.roles r
		INNER JOIN auth.user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get roles: %w", err)
	}
	defer rows.Close()

	var roles []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan role: %w", err)
		}
		roles = append(roles, name)
	}

	return roles, nil
}

func (r *postgresUserRepo) GetEffectivePermissions(ctx context.Context, userID string) ([]string, error) {
	query := `
		SELECT DISTINCT p.resource || '.' || p.action AS permission
		FROM auth.permissions p
		INNER JOIN auth.role_permissions rp ON rp.permission_id = p.id
		INNER JOIN auth.user_roles ur ON ur.role_id = rp.role_id
		WHERE ur.user_id = $1
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get permissions: %w", err)
	}
	defer rows.Close()

	permSet := make(map[string]bool)
	for rows.Next() {
		var perm string
		if err := rows.Scan(&perm); err != nil {
			return nil, fmt.Errorf("failed to scan permission: %w", err)
		}
		permSet[perm] = true
	}

	// Apply overrides
	overrideQuery := `
		SELECT p.resource || '.' || p.action, upo.effect
		FROM auth.user_permission_overrides upo
		INNER JOIN auth.permissions p ON p.id = upo.permission_id
		WHERE upo.user_id = $1
	`

	overrideRows, err := r.pool.Query(ctx, overrideQuery, userID)
	if err != nil {
		// Return base permissions if override query fails
		return mapKeys(permSet), nil
	}
	defer overrideRows.Close()

	for overrideRows.Next() {
		var perm, effect string
		if err := overrideRows.Scan(&perm, &effect); err != nil {
			continue
		}
		if effect == "ALLOW" {
			permSet[perm] = true
		} else if effect == "DENY" {
			delete(permSet, perm)
		}
	}

	return mapKeys(permSet), nil
}

func (r *postgresUserRepo) UsernameExists(ctx context.Context, username string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM auth.users WHERE username = $1)`
	err := r.pool.QueryRow(ctx, query, username).Scan(&exists)
	return exists, err
}

func (r *postgresUserRepo) EmployeeCodeExists(ctx context.Context, employeeCode string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM auth.users WHERE employee_code = $1)`
	err := r.pool.QueryRow(ctx, query, employeeCode).Scan(&exists)
	return exists, err
}

func mapKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// TotalPages calculates total pages from total count and limit.
func TotalPages(total, limit int) int {
	return int(math.Ceil(float64(total) / float64(limit)))
}
