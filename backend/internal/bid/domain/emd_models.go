package domain

import (
	"encoding/json"
	"time"
)

// EMD Lifecycle Statuses
const (
	EMDStatusPending            = "Pending"
	EMDStatusSubmitted          = "Submitted"
	EMDStatusUnderVerification  = "Under Verification"
	EMDStatusPendingMDApproval  = "Pending MD Approval"
	EMDStatusApproved           = "Approved"
	EMDStatusMDApproved         = "MD Approved"
	EMDStatusRejected           = "Rejected"
	EMDStatusPaid               = "Paid"
	EMDStatusVerified           = "Verified"
	EMDStatusReleased           = "Released"
	EMDStatusRefunded           = "Refunded"
)

// Payment Modes
const (
	PaymentModeOnline  = "Online"
	PaymentModeCheque  = "Cheque"
	PaymentModeChallan = "Challan"
)

// Cheque Statuses
const (
	ChequeStatusSubmitted = "Submitted"
	ChequeStatusDeposited = "Deposited"
	ChequeStatusCleared   = "Cleared"
	ChequeStatusBounced   = "Bounced"
	ChequeStatusCancelled = "Cancelled"
)

// Challan Statuses
const (
	ChallanStatusSubmitted = "Submitted"
	ChallanStatusVerified  = "Verified"
	ChallanStatusRejected  = "Rejected"
	ChallanStatusPaid      = "Paid"
	ChallanStatusCancelled = "Cancelled"
)

// Verification Statuses
const (
	VerificationStatusPending  = "Pending Verification"
	VerificationStatusVerified = "Verified"
	VerificationStatusRejected = "Rejected"
)

// Refund Statuses
const (
	RefundStatusNA        = "Not Applicable"
	RefundStatusPending   = "Pending"
	RefundStatusInitiated = "Initiated"
	RefundStatusReleased  = "Released"
	RefundStatusRefunded  = "Refunded"
	RefundStatusFailed    = "Failed"
)

// EMD Audit Actions
const (
	EMDActionCreated              = "CREATED"
	EMDActionUpdated              = "UPDATED"
	EMDActionSubmittedMDApproval  = "SUBMITTED_MD_APPROVAL"
	EMDActionMDApproved           = "MD_APPROVED"
	EMDActionMDRejected           = "MD_REJECTED"
	EMDActionPaymentRecorded      = "PAYMENT_RECORDED"
	EMDActionVerified             = "VERIFIED"
	EMDActionVerificationRejected = "VERIFICATION_REJECTED"
	EMDActionRefundUpdated        = "REFUND_UPDATED"
)

// ────────────────────────────────────────
// Domain Entities
// ────────────────────────────────────────

type TenderEMDDetails struct {
	ID                  string     `json:"id"`
	BidID               string     `json:"bid_id"`
	EMDAmount           float64    `json:"emd_amount"`
	DueDate             *time.Time `json:"due_date,omitempty"`
	ReferenceNumber     *string    `json:"reference_number,omitempty"`
	Purpose             *string    `json:"purpose,omitempty"`
	Status              string     `json:"status"`
	Remarks             *string    `json:"remarks,omitempty"`

	// Payment Details
	PaymentMode         *string    `json:"payment_mode,omitempty"`
	PaymentAmount       *float64   `json:"payment_amount,omitempty"`
	PaymentDate         *time.Time `json:"payment_date,omitempty"`
	PaymentStatus       *string    `json:"payment_status,omitempty"`
	PaymentReference    *string    `json:"payment_reference,omitempty"`
	PaymentDetails      []byte     `json:"-"` // raw JSONB
	PaymentReceiptURL   *string    `json:"payment_receipt_url,omitempty"`
	PaymentEnteredBy    *string    `json:"payment_entered_by,omitempty"`
	PaymentEnteredAt    *time.Time `json:"payment_entered_at,omitempty"`

	// Depositor / Person Details
	DepositorName       *string    `json:"depositor_name,omitempty"`
	DepositorEmployeeID *string    `json:"depositor_employee_id,omitempty"`
	DepositorDepartment *string    `json:"depositor_department,omitempty"`
	DepositorDesignation *string   `json:"depositor_designation,omitempty"`
	DepositorContact    *string    `json:"depositor_contact,omitempty"`
	DepositorEmail      *string    `json:"depositor_email,omitempty"`
	DepositDate         *time.Time `json:"deposit_date,omitempty"`
	DepositorRemarks    *string    `json:"depositor_remarks,omitempty"`

	// Verification
	VerificationStatus   string     `json:"verification_status"`
	VerificationRemarks  *string    `json:"verification_remarks,omitempty"`
	VerifiedBy           *string    `json:"verified_by,omitempty"`
	VerifiedAt           *time.Time `json:"verified_at,omitempty"`

	// MD Approval
	MDSubmittedBy       *string    `json:"md_submitted_by,omitempty"`
	MDSubmittedAt       *time.Time `json:"md_submitted_at,omitempty"`
	MDDecidedBy         *string    `json:"md_decided_by,omitempty"`
	MDDecidedAt         *time.Time `json:"md_decided_at,omitempty"`
	MDDecisionRemarks   *string    `json:"md_decision_remarks,omitempty"`

	// Release / Refund Tracking
	RefundStatus        string     `json:"refund_status"`
	ExpectedRefundDate  *time.Time `json:"expected_refund_date,omitempty"`
	ActualRefundDate    *time.Time `json:"actual_refund_date,omitempty"`
	RefundAmount        *float64   `json:"refund_amount,omitempty"`
	RefundReferenceNo   *string    `json:"refund_reference_no,omitempty"`
	RefundTransactionID *string    `json:"refund_transaction_id,omitempty"`
	RefundMode          *string    `json:"refund_mode,omitempty"`
	RefundRemarks       *string    `json:"refund_remarks,omitempty"`
	RefundReceiptURL    *string    `json:"refund_receipt_url,omitempty"`
	RefundUpdatedBy     *string    `json:"refund_updated_by,omitempty"`
	RefundUpdatedAt     *time.Time `json:"refund_updated_at,omitempty"`

	// Metadata
	CreatedBy           *string    `json:"created_by,omitempty"`
	UpdatedBy           *string    `json:"updated_by,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type TenderEMDAuditLog struct {
	ID        string          `json:"id"`
	BidID     string          `json:"bid_id"`
	EMDID     string          `json:"emd_id"`
	Action    string          `json:"action"`
	ActorID   *string         `json:"actor_id,omitempty"`
	ActorName *string         `json:"actor_name,omitempty"`
	ActorRole *string         `json:"actor_role,omitempty"`
	Remarks   *string         `json:"remarks,omitempty"`
	Details   json.RawMessage `json:"details,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

// ────────────────────────────────────────
// Request DTOs
// ────────────────────────────────────────

type UpdateBasicEMDRequest struct {
	EMDAmount       *float64 `json:"emd_amount"`
	DueDate         *string  `json:"due_date"`
	ReferenceNumber *string  `json:"reference_number"`
	Purpose         *string  `json:"purpose"`
	Status          *string  `json:"status"`
	Remarks         *string  `json:"remarks"`
}

type SubmitMDApprovalRequest struct {
	Remarks *string `json:"remarks"`
}

type MDDecisionRequest struct {
	Remarks string `json:"remarks"`
}

type OnlinePaymentDetails struct {
	TransactionID       string   `json:"transaction_id"`
	PaymentGateway      string   `json:"payment_gateway"`
	BankName            *string  `json:"bank_name,omitempty"`
	TransactionDateTime string   `json:"transaction_datetime"`
	PaymentAmount       float64  `json:"payment_amount"`
	PaymentStatus       string   `json:"payment_status"`
	ReceiptURL          *string  `json:"receipt_url,omitempty"`
}

type ChequePaymentDetails struct {
	ChequeNumber      string   `json:"cheque_number"`
	ChequeDate        string   `json:"cheque_date"`
	BankName          string   `json:"bank_name"`
	BranchName        *string  `json:"branch_name,omitempty"`
	AccountHolderName *string  `json:"account_holder_name,omitempty"`
	Amount            float64  `json:"amount"`
	SubmissionDate    string   `json:"submission_date"`
	ChequeStatus      string   `json:"cheque_status"`
	ReceiptURL        *string  `json:"receipt_url,omitempty"`
}

type ChallanPaymentDetails struct {
	ChallanNumber string   `json:"challan_number"`
	ChallanDate   string   `json:"challan_date"`
	BankName      string   `json:"bank_name"`
	BranchName    *string  `json:"branch_name,omitempty"`
	Amount        float64  `json:"amount"`
	ChallanType   string   `json:"challan_type"`
	ChallanStatus string   `json:"challan_status"`
	ReceiptURL    *string  `json:"receipt_url,omitempty"`
}

type DepositorDetailsDTO struct {
	Name           string  `json:"name"`
	EmployeeID     *string `json:"employee_id,omitempty"`
	Department     string  `json:"department"`
	Designation    *string `json:"designation,omitempty"`
	ContactNumber  *string `json:"contact_number,omitempty"`
	EmailID        *string `json:"email_id,omitempty"`
	DepositDate    string  `json:"deposit_date"`
	Remarks        *string `json:"remarks,omitempty"`
}

type RecordEMDPaymentRequest struct {
	PaymentMode       string                  `json:"payment_mode" binding:"required,oneof=Online Cheque Challan"`
	PaymentAmount     float64                 `json:"payment_amount" binding:"required"`
	PaymentDate       string                  `json:"payment_date" binding:"required"`
	PaymentStatus     string                  `json:"payment_status" binding:"required"`
	PaymentReference  *string                 `json:"payment_reference"`
	PaymentReceiptURL *string                 `json:"payment_receipt_url"`
	OnlineDetails     *OnlinePaymentDetails   `json:"online_details,omitempty"`
	ChequeDetails     *ChequePaymentDetails   `json:"cheque_details,omitempty"`
	ChallanDetails    *ChallanPaymentDetails  `json:"challan_details,omitempty"`
	Depositor         DepositorDetailsDTO     `json:"depositor" binding:"required"`
}

type VerifyEMDPaymentRequest struct {
	Status  string  `json:"status" binding:"required,oneof=Verified Rejected"`
	Remarks *string `json:"remarks"`
}

type UpdateEMDRefundRequest struct {
	RefundStatus          string   `json:"refund_status" binding:"required"`
	ExpectedRefundDate    *string  `json:"expected_refund_date"`
	ActualRefundDate      *string  `json:"actual_refund_date"`
	RefundAmount          *float64 `json:"refund_amount"`
	RefundReferenceNumber *string  `json:"refund_reference_number"`
	RefundTransactionID   *string  `json:"refund_transaction_id"`
	RefundMode            *string  `json:"refund_mode"`
	RefundRemarks         *string  `json:"refund_remarks"`
	RefundReceiptURL      *string  `json:"refund_receipt_url"`
}

// ────────────────────────────────────────
// Response DTOs
// ────────────────────────────────────────

type TenderEMDResponse struct {
	ID                  string          `json:"id"`
	BidID               string          `json:"bid_id"`
	EMDAmount           float64         `json:"emd_amount"`
	DueDate             *time.Time      `json:"due_date,omitempty"`
	ReferenceNumber     *string         `json:"reference_number,omitempty"`
	Purpose             *string         `json:"purpose,omitempty"`
	Status              string          `json:"status"`
	Remarks             *string         `json:"remarks,omitempty"`

	// Payment Details
	PaymentMode         *string         `json:"payment_mode,omitempty"`
	PaymentAmount       *float64        `json:"payment_amount,omitempty"`
	PaymentDate         *time.Time      `json:"payment_date,omitempty"`
	PaymentStatus       *string         `json:"payment_status,omitempty"`
	PaymentReference    *string         `json:"payment_reference,omitempty"`
	PaymentDetails      json.RawMessage `json:"payment_details,omitempty"`
	PaymentReceiptURL   *string         `json:"payment_receipt_url,omitempty"`
	PaymentEnteredBy    *UserSummary    `json:"payment_entered_by,omitempty"`
	PaymentEnteredAt    *time.Time      `json:"payment_entered_at,omitempty"`

	// Depositor / Person Details
	DepositorName       *string         `json:"depositor_name,omitempty"`
	DepositorEmployeeID *string         `json:"depositor_employee_id,omitempty"`
	DepositorDepartment *string         `json:"depositor_department,omitempty"`
	DepositorDesignation *string        `json:"depositor_designation,omitempty"`
	DepositorContact    *string         `json:"depositor_contact,omitempty"`
	DepositorEmail      *string         `json:"depositor_email,omitempty"`
	DepositDate         *time.Time      `json:"deposit_date,omitempty"`
	DepositorRemarks    *string         `json:"depositor_remarks,omitempty"`

	// Verification
	VerificationStatus   string         `json:"verification_status"`
	VerificationRemarks  *string        `json:"verification_remarks,omitempty"`
	VerifiedBy           *UserSummary   `json:"verified_by,omitempty"`
	VerifiedAt           *time.Time     `json:"verified_at,omitempty"`

	// MD Approval
	MDSubmittedBy       *UserSummary    `json:"md_submitted_by,omitempty"`
	MDSubmittedAt       *time.Time      `json:"md_submitted_at,omitempty"`
	MDDecidedBy         *UserSummary    `json:"md_decided_by,omitempty"`
	MDDecidedAt         *time.Time      `json:"md_decided_at,omitempty"`
	MDDecisionRemarks   *string         `json:"md_decision_remarks,omitempty"`

	// Release / Refund Tracking
	RefundStatus        string          `json:"refund_status"`
	ExpectedRefundDate  *time.Time      `json:"expected_refund_date,omitempty"`
	ActualRefundDate    *time.Time      `json:"actual_refund_date,omitempty"`
	RefundAmount        *float64        `json:"refund_amount,omitempty"`
	RefundReferenceNo   *string         `json:"refund_reference_no,omitempty"`
	RefundTransactionID *string         `json:"refund_transaction_id,omitempty"`
	RefundMode          *string         `json:"refund_mode,omitempty"`
	RefundRemarks       *string         `json:"refund_remarks,omitempty"`
	RefundReceiptURL    *string         `json:"refund_receipt_url,omitempty"`
	RefundUpdatedBy     *UserSummary    `json:"refund_updated_by,omitempty"`
	RefundUpdatedAt     *time.Time      `json:"refund_updated_at,omitempty"`

	// Audit Metadata
	CreatedBy           *UserSummary    `json:"created_by,omitempty"`
	UpdatedBy           *UserSummary    `json:"updated_by,omitempty"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`

	// Summary Flags for UI convenience
	IsMDApproved        bool            `json:"is_md_approved"`
	IsPaid              bool            `json:"is_paid"`
	IsVerified          bool            `json:"is_verified"`
	IsRefunded          bool            `json:"is_refunded"`
}
