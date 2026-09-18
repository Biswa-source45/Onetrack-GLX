// Package domain defines System Logs — the account/permission-layer audit
// trail. Tender activity already has its own ledger (bid.bid_stage_history,
// the "Action Ledger"); this one covers what that doesn't: user creation,
// role changes, permission overrides, and stage-access toggles. See
// migration 000041.
package domain

import (
	"context"
	"encoding/json"
	"time"

	"github.com/onetrack/backend/internal/platform/pagination"
)

const (
	CategoryUserMgmt      = "USER_MGMT"
	CategoryAccessControl = "ACCESS_CONTROL"
	CategorySecurity      = "SECURITY"
)

// Recorder lets other modules (user, bid) write a System Log entry without
// importing this package's repository/service — satisfied structurally by
// *service.service, the same reuse pattern as feedback's FieldMemory
// interface. Best-effort by design: it doesn't return an error, so a logging
// failure never blocks the mutation it's describing.
type Recorder interface {
	Record(ctx context.Context, category, eventType, actorID string, targetUserID *string, summary string, details interface{})
}

// Event is one row as written to auth.system_events.
type Event struct {
	ID           string
	Category     string
	EventType    string
	ActorID      string
	TargetUserID *string
	Summary      string
	Details      json.RawMessage
	CreatedAt    time.Time
}

type UserRef struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
}

// EventItem is one row resolved for the System Logs page — actor/target
// names joined in, not just their ids.
type EventItem struct {
	ID         string          `json:"id"`
	Category   string          `json:"category"`
	EventType  string          `json:"event_type"`
	Actor      UserRef         `json:"actor"`
	TargetUser *UserRef        `json:"target_user,omitempty"`
	Summary    string          `json:"summary"`
	Details    json.RawMessage `json:"details,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

// ListQuery drives keyset ("cursor") pagination over the log, optionally
// scoped to one category.
type ListQuery struct {
	Limit    int
	Cursor   string
	Category string
}

type Page struct {
	Items      []EventItem `json:"items"`
	NextCursor string      `json:"next_cursor,omitempty"`
	HasMore    bool        `json:"has_more"`
}

// ErrInvalidCursor mirrors the bid/feedback modules' aliasing of the shared
// pagination sentinel, so handlers can errors.Is against one type regardless
// of which module's cursor failed to decode.
var ErrInvalidCursor = pagination.ErrInvalidCursor
