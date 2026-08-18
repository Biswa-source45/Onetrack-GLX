package domain

import (
	"context"
	"time"
)

type Alert struct {
	ID         string    `json:"id"`
	UserID     *string   `json:"user_id,omitempty"`
	TargetRole string    `json:"target_role,omitempty"`
	BidID      *string   `json:"bid_id,omitempty"`
	CreatedBy  *string   `json:"created_by,omitempty"`
	Type       string    `json:"type"`
	Title      string    `json:"title"`
	Message    string    `json:"message"`
	IsRead     bool      `json:"is_read"`
	CreatedAt  time.Time `json:"created_at"`
}

type AlertRepository interface {
	CreateAlert(ctx context.Context, alert *Alert) error
	GetUserAlerts(ctx context.Context, userID string, userRole string) ([]Alert, error)
	MarkAsRead(ctx context.Context, alertID string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string, userRole string) error
}

type AlertService interface {
	CreateAlert(ctx context.Context, alert *Alert) error
	GetUserAlerts(ctx context.Context, userID string, userRole string) ([]Alert, error)
	MarkAsRead(ctx context.Context, alertID string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string, userRole string) error
}
