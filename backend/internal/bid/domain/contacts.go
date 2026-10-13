package domain

import "time"

// Contact kinds of a tender. Customer and accounts are the same list; Bidder is our own side.
const (
	ContactKindCustomer = "CUSTOMER"
	ContactKindBidder   = "BIDDER"
	ContactKindOEM      = "OEM"
	ContactKindOther    = "OTHER"

	// ContactSourceOEMAuth marks a contact typed in OEM Authorization; SourceRef is that matrix row's id.
	ContactSourceManual  = "MANUAL"
	ContactSourceOEMAuth = "OEM_AUTH"
)

var ContactKinds = map[string]bool{ContactKindCustomer: true, ContactKindBidder: true, ContactKindOEM: true, ContactKindOther: true}

// TenderContact is one person on a tender. Banned means "do not use": the contact stays listed.
type TenderContact struct {
	ID           string     `json:"id"`
	BidID        string     `json:"bid_id"`
	Kind         string     `json:"kind"`
	Name         string     `json:"name"`
	Org          string     `json:"org"`
	Designation  string     `json:"designation"`
	Phone        string     `json:"phone"`
	Email        string     `json:"email"`
	Notes        string     `json:"notes"`
	Source       string     `json:"source"`
	SourceRef    string     `json:"source_ref"`
	Banned       bool       `json:"banned"`
	BannedReason string     `json:"banned_reason"`
	BannedAt     *time.Time `json:"banned_at,omitempty"`
	SortOrder    int        `json:"sort_order"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// SaveContactRequest creates a contact; Source/SourceRef are fixed at creation.
type SaveContactRequest struct {
	Kind        string `json:"kind"`
	Name        string `json:"name"`
	Org         string `json:"org"`
	Designation string `json:"designation"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	Notes       string `json:"notes"`
	Source      string `json:"source"`
	SourceRef   string `json:"source_ref"`
}

// UpdateContactRequest changes only the fields that are sent.
type UpdateContactRequest struct {
	Kind         *string `json:"kind"`
	Name         *string `json:"name"`
	Org          *string `json:"org"`
	Designation  *string `json:"designation"`
	Phone        *string `json:"phone"`
	Email        *string `json:"email"`
	Notes        *string `json:"notes"`
	Banned       *bool   `json:"banned"`
	BannedReason *string `json:"banned_reason"`
}

// ReorderContactItem places a contact in a column (drag and drop): the whole column is sent.
type ReorderContactItem struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	SortOrder int    `json:"sort_order"`
}

type ReorderContactsRequest struct {
	Items []ReorderContactItem `json:"items"`
}
