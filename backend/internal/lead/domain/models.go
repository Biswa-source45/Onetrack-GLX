package domain

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrValidation = errors.New("validation error")
	ErrNotFound   = errors.New("not found")
)

const (
	StatusPublished   = "PUBLISHED"
	StatusUnpublished = "UNPUBLISHED"
)

type UserSummary struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
}

type Lead struct {
	ID               string          `json:"id"`
	PublishStatus    string          `json:"publish_status"`
	LeadType         string          `json:"lead_type"`
	AccountName      string          `json:"account_name"`
	DepartmentName   *string         `json:"department_name"`
	Location         *string         `json:"location"`
	HighLevelScope   *string         `json:"high_level_scope"`
	ExpectedDate     *string         `json:"expected_date"` // YYYY-MM-DD
	ScopeType        *string         `json:"scope_type"`
	Category         *string         `json:"category"`
	EstimatedValue   *float64        `json:"estimated_value"`
	Title            *string         `json:"title"`
	PublishedDetails json.RawMessage `json:"published_details"`
	LeadOwner        UserSummary     `json:"lead_owner"`
	ReportingManager *UserSummary    `json:"reporting_manager"`
	CreatedBy        UserSummary     `json:"created_by"`
	FolderName       string          `json:"folder_name"`
	DocumentCount    int             `json:"document_count"`
	// No omitempty: the detail page reads this as a list, and omitempty
	// dropped the key entirely for a lead with no documents.
	Documents []Document `json:"documents"`

	// Approval workflow — see workflow.go. Approver is who the lead was
	// last sent to. Events, AllowedActions and CanEdit are filled only on
	// the detail response; the last two are computed for the caller, so
	// the page never re-implements the rules.
	Stage          string       `json:"stage"`
	Approver       *UserSummary `json:"approver"`
	Events         []Event      `json:"events"`
	AllowedActions []string     `json:"allowed_actions"`
	CanEdit        bool         `json:"can_edit"`
	CanDelete      bool         `json:"can_delete"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

type Document struct {
	ID           string    `json:"id"`
	Category     *string   `json:"category"`
	OriginalName string    `json:"original_name"`
	StoredPath   string    `json:"-"`
	ContentType  string    `json:"content_type"`
	SizeBytes    int64     `json:"size_bytes"`
	UploadedBy   *string   `json:"uploaded_by_name"`
	CreatedAt    time.Time `json:"created_at"`
}

type CreateLeadRequest struct {
	PublishStatus      string          `json:"publish_status"`
	LeadType           string          `json:"lead_type"`
	AccountName        string          `json:"account_name"`
	DepartmentName     *string         `json:"department_name"`
	Location           *string         `json:"location"`
	HighLevelScope     *string         `json:"high_level_scope"`
	ExpectedDate       *string         `json:"expected_date"`
	ScopeType          *string         `json:"scope_type"`
	Category           *string         `json:"category"`
	EstimatedValue     *float64        `json:"estimated_value"`
	Title              *string         `json:"title"`
	PublishedDetails   json.RawMessage `json:"published_details"`
	LeadOwnerID        string          `json:"lead_owner_id"`
	ReportingManagerID *string         `json:"reporting_manager_id"`
}

// Normalize trims every text field (blank -> nil), then enforces the rules
// that hold no matter which client sent the request. Published-only data
// is dropped for an UNPUBLISHED lead rather than rejected, so a form that
// toggled back and forth can't smuggle stale tender details in.
func (r *CreateLeadRequest) Normalize() error {
	r.PublishStatus = strings.ToUpper(strings.TrimSpace(r.PublishStatus))
	r.LeadType = strings.ToUpper(strings.TrimSpace(r.LeadType))
	r.AccountName = strings.TrimSpace(r.AccountName)
	r.LeadOwnerID = strings.TrimSpace(r.LeadOwnerID)
	for _, p := range []**string{&r.DepartmentName, &r.Location, &r.HighLevelScope, &r.ExpectedDate,
		&r.ScopeType, &r.Category, &r.Title, &r.ReportingManagerID} {
		if *p != nil {
			if v := strings.TrimSpace(**p); v == "" {
				*p = nil
			} else {
				*p = &v
			}
		}
	}

	if r.PublishStatus != StatusPublished && r.PublishStatus != StatusUnpublished {
		return fmt.Errorf("%w: lead status must be Published or Unpublished", ErrValidation)
	}
	if r.LeadType != "PVT" && r.LeadType != "GOV" {
		return fmt.Errorf("%w: lead type must be PVT or GOV", ErrValidation)
	}
	if r.AccountName == "" {
		return fmt.Errorf("%w: account name is required", ErrValidation)
	}
	if r.LeadOwnerID == "" {
		return fmt.Errorf("%w: lead owner is required", ErrValidation)
	}
	if r.ExpectedDate != nil {
		if _, err := time.Parse("2006-01-02", *r.ExpectedDate); err != nil {
			return fmt.Errorf("%w: expected date must be YYYY-MM-DD", ErrValidation)
		}
	}
	if r.EstimatedValue != nil && *r.EstimatedValue < 0 {
		return fmt.Errorf("%w: estimated value cannot be negative", ErrValidation)
	}

	if r.PublishStatus == StatusUnpublished {
		r.Title = nil
		r.PublishedDetails = nil
		return nil
	}
	if r.Title == nil {
		return fmt.Errorf("%w: tender title is required for a published lead", ErrValidation)
	}
	if len(r.PublishedDetails) > 0 && string(r.PublishedDetails) != "null" {
		var obj map[string]any
		if err := json.Unmarshal(r.PublishedDetails, &obj); err != nil {
			return fmt.Errorf("%w: published details must be a JSON object", ErrValidation)
		}
	} else {
		r.PublishedDetails = nil
	}
	return nil
}

// FolderSlug turns a lead's display name into a filesystem-safe folder stem:
// lowercase ASCII letters/digits joined by single hyphens, capped at 50
// chars. Never empty — falls back to "lead".
func FolderSlug(name string) string {
	var b strings.Builder
	dash := false
	for _, c := range strings.ToLower(name) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			b.WriteRune(c)
			dash = false
		} else if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
		if b.Len() >= 50 {
			break
		}
	}
	s := strings.Trim(b.String(), "-")
	if s == "" {
		return "lead"
	}
	return s
}
