package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/alert/domain"
)

type postgresAlertRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresAlertRepository(pool *pgxpool.Pool) domain.AlertRepository {
	return &postgresAlertRepo{pool: pool}
}

func (r *postgresAlertRepo) CreateAlert(ctx context.Context, alert *domain.Alert) error {
	query := `
		INSERT INTO public.alerts (user_id, target_role, bid_id, type, title, message, link, is_read)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), false)
		RETURNING id, created_at
	`
	return r.pool.QueryRow(ctx, query,
		alert.UserID,
		alert.TargetRole,
		alert.BidID,
		alert.Type,
		alert.Title,
		alert.Message,
		alert.Link,
	).Scan(&alert.ID, &alert.CreatedAt)
}

func (r *postgresAlertRepo) GetUserAlerts(ctx context.Context, userID string, userRole string) ([]domain.Alert, error) {
	query := `
		SELECT a.id, a.user_id, a.target_role, a.bid_id, a.type, a.title, a.message, COALESCE(a.link, ''), a.is_read, a.created_at,
		       CASE
		           WHEN b.bid_status = 'CANCELLED' OR b.workflow_stage = 'CANCELLED' OR b.bid_outcome = 'CANCELLED' THEN 'CANCELLED'
		           WHEN b.bid_status = 'CLOSED' THEN 'CLOSED'
		           ELSE ''
		       END
		FROM public.alerts a
		LEFT JOIN bid.bid_workspaces b ON b.id = a.bid_id
		WHERE a.user_id = $1 OR a.target_role = $2 OR a.target_role = 'ALL'
		ORDER BY a.created_at DESC
		LIMIT 100
	`
	rows, err := r.pool.Query(ctx, query, userID, userRole)
	if err != nil {
		return nil, fmt.Errorf("failed to query alerts: %w", err)
	}
	defer rows.Close()

	var alerts []domain.Alert
	for rows.Next() {
		var a domain.Alert
		if err := rows.Scan(&a.ID, &a.UserID, &a.TargetRole, &a.BidID, &a.Type, &a.Title, &a.Message, &a.Link, &a.IsRead, &a.CreatedAt, &a.BidState); err != nil {
			return nil, fmt.Errorf("failed to scan alert: %w", err)
		}
		alerts = append(alerts, a)
	}
	return alerts, nil
}

func (r *postgresAlertRepo) MarkAsRead(ctx context.Context, alertID string, userID string) error {
	query := `UPDATE public.alerts SET is_read = true WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, alertID)
	return err
}

func (r *postgresAlertRepo) MarkAllAsRead(ctx context.Context, userID string, userRole string) error {
	query := `UPDATE public.alerts SET is_read = true WHERE user_id = $1 OR target_role = $2 OR target_role = 'ALL'`
	_, err := r.pool.Exec(ctx, query, userID, userRole)
	return err
}

// DeleteAlert removes an alert, but only if it was actually visible to this
// user (their own targeted alert, or a role/ALL broadcast they'd see) — the
// same scoping rule GetUserAlerts uses — so one user can't delete another's
// private alert just by guessing an ID.
func (r *postgresAlertRepo) DeleteAlert(ctx context.Context, alertID string, userID string, userRole string) error {
	query := `DELETE FROM public.alerts WHERE id = $1 AND (user_id = $2 OR target_role = $3 OR target_role = 'ALL')`
	tag, err := r.pool.Exec(ctx, query, alertID, userID, userRole)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("alert not found or not permitted")
	}
	return nil
}
