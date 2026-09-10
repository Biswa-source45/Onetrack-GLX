package domain

import (
	"errors"
	"time"
)

// ErrValidation wraps request-validation failures so handlers can distinguish
// a 400 (bad input) from a genuine 500 (unexpected server/repo failure) —
// mirrors the same sentinel already used by the bid module.
var ErrValidation = errors.New("validation failed")

// ErrForbidden is returned when a non-owner, non-Super-Admin tries to read
// a ticket that isn't theirs.
var ErrForbidden = errors.New("forbidden")

const (
	StatusOpen       = "OPEN"
	StatusInProgress = "IN_PROGRESS"
	StatusResolved   = "RESOLVED"
)

var ValidStatuses = map[string]bool{
	StatusOpen:       true,
	StatusInProgress: true,
	StatusResolved:   true,
}

// Ticket is the raw row shape, used for inserts.
type Ticket struct {
	ID             string
	UserID         string
	Category       string
	CustomCategory *string
	Description    string
	Status         string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type UserSummary struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
}

// TicketResponse is the fully-resolved, client-facing shape — reporter and
// resolver names joined in at read time, same convention the bid module's
// audit trail already uses.
type TicketResponse struct {
	ID             string       `json:"id"`
	Category       string       `json:"category"`
	CustomCategory *string      `json:"custom_category,omitempty"`
	Description    string       `json:"description"`
	Status         string       `json:"status"`
	Reporter       UserSummary  `json:"reporter"`
	ResolvedBy     *UserSummary `json:"resolved_by,omitempty"`
	ResolvedAt     *time.Time   `json:"resolved_at,omitempty"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

type TicketStatusEvent struct {
	ID         string       `json:"id"`
	FromStatus *string      `json:"from_status,omitempty"`
	ToStatus   string       `json:"to_status"`
	ChangedBy  *UserSummary `json:"changed_by,omitempty"`
	Note       *string      `json:"note,omitempty"`
	CreatedAt  time.Time    `json:"created_at"`
}

// TicketStatusHistoryInsert is the write-side param for AddStatusHistory.
type TicketStatusHistoryInsert struct {
	TicketID   string
	FromStatus *string
	ToStatus   string
	ChangedBy  string
	Note       *string
}

type CreateTicketRequest struct {
	Category       string  `json:"category" binding:"required"`
	CustomCategory *string `json:"custom_category"`
	Description    string  `json:"description" binding:"required"`
}

type UpdateTicketStatusRequest struct {
	Status string  `json:"status" binding:"required"`
	Note   *string `json:"note"`
}

// ListTicketsParams drives both "my tickets" (UserID set) and the Super
// Admin list (UserID empty, optional Status/Category filter). Cursor paging
// mirrors Action Ledger's — same reasoning: OFFSET degrades as the table
// grows, and tickets are exactly the kind of table that only grows.
type ListTicketsParams struct {
	UserID   string
	Status   string
	Category string
	Limit    int
	Cursor   string
}

type TicketListPage struct {
	Items      []TicketResponse `json:"items"`
	NextCursor string           `json:"next_cursor,omitempty"`
	HasMore    bool             `json:"has_more"`
}
