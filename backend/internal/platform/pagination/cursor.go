// Package pagination is a small keyset ("cursor") pagination helper shared
// by every module that pages a newest-first, append-only table — the bid
// module's audit trail and the feedback module's tickets both use it.
// Keyset pagination pages by an opaque (created_at, id) cursor instead of
// OFFSET, which gets slower as a table grows and can skip or repeat rows
// when new rows are inserted between page loads.
package pagination

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ErrInvalidCursor is returned when a cursor doesn't decode — hand-edited,
// or stale across a deploy — so callers can return 400 instead of 500.
var ErrInvalidCursor = errors.New("invalid pagination cursor")

// Encode packs a (created_at, id) keyset position into an opaque cursor.
func Encode(createdAt time.Time, id string) string {
	raw := createdAt.UTC().Format(time.RFC3339Nano) + "|" + id
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

// Decode unpacks a cursor produced by Encode.
func Decode(cursor string) (time.Time, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", fmt.Errorf("%w: %v", ErrInvalidCursor, err)
	}
	parts := strings.SplitN(string(raw), "|", 2)
	if len(parts) != 2 {
		return time.Time{}, "", ErrInvalidCursor
	}
	t, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, "", fmt.Errorf("%w: %v", ErrInvalidCursor, err)
	}
	return t, parts[1], nil
}

// PageSize clamps a requested page size: unset (<=0) falls back to def,
// anything over max is capped at max rather than silently reset.
func PageSize(limit, def, max int) int {
	if limit <= 0 {
		return def
	}
	if limit > max {
		return max
	}
	return limit
}
