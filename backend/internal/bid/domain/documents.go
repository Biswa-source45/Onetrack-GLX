package domain

import (
	"errors"
	"time"
)

// ErrNotFound is returned by the document repository when a row does not exist
// (or belongs to a different tender).
var ErrNotFound = errors.New("not found")

// TenderDocument is one named file attached to a tender. Name is the label
// ("RFP", "ATC", ...); StoredPath is relative to the tender's docs folder and is
// never sent to the client.
type TenderDocument struct {
	ID             string    `json:"id"`
	BidID          string    `json:"bid_id"`
	Name           string    `json:"name"`
	OriginalName   string    `json:"original_name"`
	StoredPath     string    `json:"-"`
	ContentType    string    `json:"content_type"`
	SizeBytes      int64     `json:"size_bytes"`
	UploadedBy     string    `json:"uploaded_by,omitempty"`
	UploadedByName string    `json:"uploaded_by_name,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
