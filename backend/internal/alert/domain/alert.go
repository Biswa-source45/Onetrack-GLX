package domain

import (
	"context"
	"strings"
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
	// Link is the in-app path the alert opens (and the email button points
	// at) — see TenderLink/StageLink/ApprovalLink. Always app-relative.
	Link       string    `json:"link,omitempty"`
	IsRead     bool      `json:"is_read"`
	CreatedAt  time.Time `json:"created_at"`
	// BidState is CANCELLED or CLOSED when the alert's tender has since left
	// the pipeline (read-only, set by GetUserAlerts) — the alert body is a
	// snapshot from when it was sent, so the inbox flags it as no longer live.
	BidState string `json:"bid_state,omitempty"`
}

// TenderLink, StageLink and ApprovalLink build the deep links alerts carry —
// the query params are the ones TenderDetailPage reads (?tab=&stage=, and
// ?approval=1 to open the pending edit/cancel/delete review).
func TenderLink(bidID string) string { return "/dashboard/tenders/" + bidID }

func StageLink(bidID, stage string) string {
	return TenderLink(bidID) + "?tab=stages&stage=" + stage
}

func ApprovalLink(bidID string) string { return TenderLink(bidID) + "?approval=1" }

// SafeLink keeps a caller-supplied link only if it's an in-app dashboard
// path — it's rendered into an email href and navigated to on click, so an
// absolute/protocol-relative URL must never get through. Falls back to the
// tender's own page when the alert is about one.
func SafeLink(link string, bidID *string) string {
	if strings.HasPrefix(link, "/dashboard/") && !strings.ContainsAny(link, "\\\"<> ") {
		return link
	}
	if bidID != nil && *bidID != "" {
		return TenderLink(*bidID)
	}
	return ""
}

type AlertRepository interface {
	CreateAlert(ctx context.Context, alert *Alert) error
	GetUserAlerts(ctx context.Context, userID string, userRole string) ([]Alert, error)
	MarkAsRead(ctx context.Context, alertID string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string, userRole string) error
	DeleteAlert(ctx context.Context, alertID string, userID string, userRole string) error
}

type AlertService interface {
	CreateAlert(ctx context.Context, alert *Alert) error
	// SendNotificationEmail dispatches only the email side of a notification
	// — same recipient resolution and HTML template CreateAlert already
	// uses, but never writes an in-app alert row. For notifications that
	// have their own dedicated in-app surface (Feedback Loop's Tickets
	// badge, say) so they don't also clutter the general Alerts inbox.
	SendNotificationEmail(ctx context.Context, alert *Alert) error
	GetUserAlerts(ctx context.Context, userID string, userRole string) ([]Alert, error)
	MarkAsRead(ctx context.Context, alertID string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string, userRole string) error
	DeleteAlert(ctx context.Context, alertID string, userID string, userRole string) error
}
