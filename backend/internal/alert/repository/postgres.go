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
		INSERT INTO public.alerts (user_id, target_role, bid_id, type, title, message, is_read)
		VALUES ($1, $2, $3, $4, $5, $6, false)
		RETURNING id, created_at
	`
	return r.pool.QueryRow(ctx, query,
		alert.UserID,
		alert.TargetRole,
		alert.BidID,
		alert.Type,
		alert.Title,
		alert.Message,
	).Scan(&alert.ID, &alert.CreatedAt)
}

func (r *postgresAlertRepo) GetUserAlerts(ctx context.Context, userID string, userRole string) ([]domain.Alert, error) {
	query := `
		SELECT id, user_id, target_role, bid_id, type, title, message, is_read, created_at
		FROM public.alerts
		WHERE user_id = $1 OR target_role = $2 OR target_role = 'ALL'
		ORDER BY created_at DESC
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
		if err := rows.Scan(&a.ID, &a.UserID, &a.TargetRole, &a.BidID, &a.Type, &a.Title, &a.Message, &a.IsRead, &a.CreatedAt); err != nil {
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
