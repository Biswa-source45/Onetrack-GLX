package domain

import "time"

// CreationMode drives how the bid was initialized — not its lifecycle
const (
	CreationModeManual       = "MANUAL"
	CreationModeIntelligence = "INTELLIGENCE"
)

// 12 Workflow stages matching OneTrack V2 GeM migration plan
const (
	StageDiscovered              = "DISCOVERED"
	StageEligibilityAssessment   = "ELIGIBILITY_ASSESSMENT"
	StageOEMAuthorizationRequest = "OEM_AUTHORIZATION_REQUEST"
	StagePricingRequest          = "PRICING_REQUEST"
	StageDocumentChecklistPrep   = "DOCUMENT_CHECKLIST_PREPARATION"
	StageEMDProcessing           = "EMD_PROCESSING"
	StageBidDocumentation        = "BID_DOCUMENTATION"
	StageInternalApproval        = "INTERNAL_APPROVAL"
	StageGeMSubmission           = "GEM_SUBMISSION"
	StageTechnicalEvaluation     = "TECHNICAL_EVALUATION"
	StageFinancialEvaluation     = "FINANCIAL_EVALUATION"
	StageAwardHandover           = "AWARD_HANDOVER"

	StageWon       = "WON"
	StageLost      = "LOST"
	StageCancelled = "CANCELLED"
)

var OrderedWorkflowStages = []string{
	StageDiscovered,
	StageEligibilityAssessment,
	StageOEMAuthorizationRequest,
	StagePricingRequest,
	StageDocumentChecklistPrep,
	StageEMDProcessing,
	StageBidDocumentation,
	StageInternalApproval,
	StageGeMSubmission,
	StageTechnicalEvaluation,
	StageFinancialEvaluation,
	StageAwardHandover,
}

// Bid status
const (
	BidStatusActive    = "ACTIVE"
	BidStatusCancelled = "CANCELLED"
	BidStatusArchived  = "ARCHIVED"
	BidStatusWon       = "WON"
	BidStatusLost      = "LOST"
)

// Bid outcome
const (
	OutcomeWon       = "WON"
	OutcomeLost      = "LOST"
	OutcomeCancelled = "CANCELLED"
)

// ────────────────────────────────────────
// Core entity
// ────────────────────────────────────────

type BidWorkspace struct {
	ID               string  `json:"id"`
	BidNo            *string `json:"bid_no,omitempty"`
	GemBidNo         *string `json:"gem_bid_no,omitempty"`
	Title            string  `json:"title"`
	OrganizationName *string `json:"organization_name,omitempty"`
	DepartmentName   *string `json:"department_name,omitempty"`
	PortalSource     string  `json:"portal_source"`
	CreationMode     string  `json:"creation_mode"`
	WorkflowStage    string  `json:"workflow_stage"`
	BidStatus        string  `json:"bid_status"`
	BidOwnerID          string  `json:"bid_owner_id"`
	TechnicalManagerID  *string `json:"technical_manager_id,omitempty"`
	CreatedBy           string  `json:"created_by"`

	// Financial
	EstimatedValue *float64 `json:"estimated_value,omitempty"`
	EMDAmount      *float64 `json:"emd_amount,omitempty"`
	EMDType        *string  `json:"emd_type,omitempty"`
	EMDExempted    bool     `json:"emd_exempted"`
	FinalBidValue  *float64 `json:"final_bid_value,omitempty"`
	L1Price        *float64 `json:"l1_price,omitempty"`
	QuotedPrice    *float64 `json:"quoted_price,omitempty"`

	// Dates
	OpeningDate    *time.Time `json:"opening_date,omitempty"`
	ClosingDate    *time.Time `json:"closing_date,omitempty"`
	SubmissionDate *time.Time `json:"submission_date,omitempty"`
	ResultDate     *time.Time `json:"result_date,omitempty"`
	RADate         *time.Time `json:"ra_date,omitempty"`

	// Categorization
	Category    *string `json:"category,omitempty"`
	BidType     *string `json:"bid_type,omitempty"`
	GemBidType  *string `json:"gem_bid_type,omitempty"`
	OEMRequired bool    `json:"oem_required"`
	HasTechEval bool    `json:"has_tech_eval"`

	// Outcome
	QualificationStatus  string  `json:"qualification_status"`
	BidOutcome           *string `json:"bid_outcome,omitempty"`
	OutcomeReason        *string `json:"outcome_reason,omitempty"`
	TechComplianceStatus *string `json:"tech_compliance_status,omitempty"`

	// Additional
	Remarks        *string `json:"remarks,omitempty"`
	CompetitorInfo []byte  `json:"-"` // raw JSONB
	Metadata       []byte  `json:"-"` // raw JSONB

	// AI fields (populated only for INTELLIGENCE mode)
	AISourceDocumentID     *string  `json:"ai_source_document_id,omitempty"`
	AIExtractionConfidence *float64 `json:"ai_extraction_confidence,omitempty"`

	// Timestamps
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	ArchivedAt *time.Time `json:"archived_at,omitempty"`

	// V2 Core Fields
	HighLevelScope *string `json:"high_level_scope,omitempty"`
	StartDate      *time.Time `json:"start_date,omitempty"`
	EndDate        *time.Time `json:"end_date,omitempty"`
	DurationMonths *int    `json:"duration_months,omitempty"`
	BGRequired     bool    `json:"bg_required"`
	Authority      *string `json:"authority,omitempty"`

	// Stage tracking
	StageCompletions  []byte `json:"-"` // raw JSONB
	StageRemarks      []byte `json:"-"` // raw JSONB
	StageReviews      []byte `json:"-"` // raw JSONB
	PricingWorkspace  []byte `json:"-"` // raw JSONB — Stage 4 pricing workspace (shared across users)
	FinanceAlerted    bool   `json:"finance_alerted"`
	FinanceAlertAt    *time.Time `json:"finance_alert_at,omitempty"`
	EMDReady          bool   `json:"emd_ready"`
	EMDReturned       bool   `json:"emd_returned"`
	BGDischarged      bool   `json:"bg_discharged"`
	SubmissionDone    bool   `json:"submission_done"`
	GemSubmissionPrice *float64 `json:"gem_submission_price,omitempty"`
	FinalPrice         *float64 `json:"final_price,omitempty"`
	TechnicalResult    *string  `json:"technical_result,omitempty"`
	DisqualificationReason *string `json:"disqualification_reason,omitempty"`
	FinancialResult    *string  `json:"financial_result,omitempty"`
	L1CompanyName      *string  `json:"l1_company_name,omitempty"`
	PriceDifference    *float64 `json:"price_difference,omitempty"`
	PriceDifferencePct *float64 `json:"price_difference_pct,omitempty"`
	EligibilityRemarks *string  `json:"eligibility_remarks,omitempty"`
	EMDRemarks         *string  `json:"emd_remarks,omitempty"`

	// Excel bulk upload fields
	Team                      *string    `json:"team,omitempty"`
	ScopeType                 *string    `json:"scope_type,omitempty"`
	BGRate                    *float64   `json:"bg_rate,omitempty"`
	ActivityType              *string    `json:"activity_type,omitempty"`
	TargetMonthDate           *time.Time `json:"target_month_date,omitempty"`
	ExcelBidStatus            *string    `json:"excel_bid_status,omitempty"`
	SubmissionStatus          *string    `json:"submission_status,omitempty"`
	FinancialEvaluationStatus *string    `json:"financial_evaluation_status,omitempty"`
	POReceivedStatus          *string    `json:"po_received_status,omitempty"`
	BidResult                 *string    `json:"bid_result,omitempty"`
}

type BidChecklist struct {
	ID             string     `json:"id"`
	BidID          string     `json:"bid_id"`
	Title          string     `json:"title"`
	IsDone         bool       `json:"is_done"`
	DoneBy         *string    `json:"done_by,omitempty"`
	DoneAt         *time.Time `json:"done_at,omitempty"`
	SortOrder      int        `json:"sort_order"`
	ChecklistGroup string     `json:"checklist_group"`
	CreatedAt      time.Time  `json:"created_at"`
}

type BidChecklistItem struct {
	ID             string       `json:"id"`
	Title          string       `json:"title"`
	IsDone         bool         `json:"is_done"`
	DoneBy         *UserSummary `json:"done_by,omitempty"`
	DoneAt         *time.Time   `json:"done_at,omitempty"`
	SortOrder      int          `json:"sort_order"`
	ChecklistGroup string       `json:"checklist_group"`
	CreatedAt      time.Time    `json:"created_at"`
}

type AddChecklistRequest struct {
	Title     string `json:"title" binding:"required"`
	SortOrder *int   `json:"sort_order"`
}

type UpdateChecklistRequest struct {
	Title     *string `json:"title"`
	SortOrder *int    `json:"sort_order"`
}

type ReorderChecklistItem struct {
	ID        string `json:"id" binding:"required"`
	SortOrder int    `json:"sort_order"`
}

type ReorderChecklistRequest struct {
	Items []ReorderChecklistItem `json:"items" binding:"required,min=1"`
}

type BidWorkspaceMember struct {
	ID      string    `json:"id"`
	BidID   string    `json:"bid_id"`
	UserID  string    `json:"user_id"`
	Role    string    `json:"role"`
	AddedBy *string   `json:"added_by,omitempty"`
	AddedAt time.Time `json:"added_at"`
}

type BidStageHistory struct {
	ID               string    `json:"id"`
	BidID            string    `json:"bid_id"`
	FromStage        *string   `json:"from_stage,omitempty"`
	ToStage          string    `json:"to_stage"`
	TransitionReason *string   `json:"transition_reason,omitempty"`
	TransitionedBy   string    `json:"transitioned_by"`
	CreatedAt        time.Time `json:"created_at"`
}

// ────────────────────────────────────────
// Request DTOs
// ────────────────────────────────────────

type CreateBidRequest struct {
	CreationMode     string   `json:"creation_mode" binding:"required,oneof=MANUAL INTELLIGENCE"`
	Title            string   `json:"title" binding:"required"`
	BidNo            *string  `json:"bid_no"`
	GemBidNo         *string  `json:"gem_bid_no"`
	OrganizationName *string  `json:"organization_name"`
	DepartmentName   *string  `json:"department_name"`
	PortalSource     *string  `json:"portal_source"`
	BidType          *string  `json:"bid_type"`
	GemBidType       *string  `json:"gem_bid_type"`
	Category         *string  `json:"category"`
	EstimatedValue   *float64 `json:"estimated_value"`
	EMDAmount        *float64 `json:"emd_amount"`
	EMDType          *string  `json:"emd_type"`
	EMDExempted      *bool    `json:"emd_exempted"`
	HighLevelScope   *string  `json:"high_level_scope"`
	BGRequired       *bool    `json:"bg_required"`
	StartDate        *string  `json:"start_date"`
	EndDate          *string  `json:"end_date"`
	OpeningDate      *string  `json:"opening_date,omitempty"`
	ClosingDate      *string  `json:"closing_date,omitempty"`
	DurationMonths   *int     `json:"duration_months"`
	Authority        *string  `json:"authority"`
	BidOwnerID          string   `json:"bid_owner_id" binding:"required"`
	TechnicalManagerID  *string  `json:"technical_manager_id"`
	Remarks             *string  `json:"remarks"`
	Metadata            *string  `json:"metadata"` // raw JSON string
	BidderChecklists    []string `json:"bidder_checklists"` // bidder doc checklist titles
	OEMChecklists       []string `json:"oem_checklists"`    // OEM doc checklist titles
	Checklists          []string `json:"checklists"` // legacy support
	Team                      *string  `json:"team,omitempty"`
	ScopeType                 *string  `json:"scope_type,omitempty"`
	BGRate                    *float64 `json:"bg_rate,omitempty"`
	ActivityType              *string  `json:"activity_type,omitempty"`
	TargetMonthDate           *string  `json:"target_month_date,omitempty"`
	ExcelBidStatus            *string  `json:"excel_bid_status,omitempty"`
	SubmissionStatus          *string  `json:"submission_status,omitempty"`
	FinancialEvaluationStatus *string  `json:"financial_evaluation_status,omitempty"`
	POReceivedStatus          *string  `json:"po_received_status,omitempty"`
	BidResult                 *string  `json:"bid_result,omitempty"`
}

type UpdateBidRequest struct {
	Title            *string  `json:"title"`
	BidNo            *string  `json:"bid_no"`
	GemBidNo         *string  `json:"gem_bid_no"`
	OrganizationName *string  `json:"organization_name"`
	DepartmentName   *string  `json:"department_name"`
	PortalSource     *string  `json:"portal_source"`
	BidType          *string  `json:"bid_type"`
	GemBidType       *string  `json:"gem_bid_type"`
	Category         *string  `json:"category"`
	EstimatedValue   *float64 `json:"estimated_value"`
	EMDAmount        *float64 `json:"emd_amount"`
	EMDType          *string  `json:"emd_type"`
	EMDExempted      *bool    `json:"emd_exempted"`
	HighLevelScope   *string  `json:"high_level_scope"`
	BGRequired       *bool    `json:"bg_required"`
	BGRate           *float64 `json:"bg_rate"`
	StartDate        *string  `json:"start_date"`
	EndDate          *string  `json:"end_date"`
	OpeningDate      *string  `json:"opening_date,omitempty"`
	ClosingDate      *string  `json:"closing_date,omitempty"`
	DurationMonths   *int     `json:"duration_months"`
	Authority        *string  `json:"authority"`
	TechnicalManagerID        *string  `json:"technical_manager_id"`
	Remarks                   *string  `json:"remarks"`
	TechComplianceStatus      *string  `json:"tech_compliance_status"`
	QualificationStatus       *string  `json:"qualification_status"`
	WorkflowStage             *string  `json:"workflow_stage,omitempty"`
	BidStatus                 *string  `json:"bid_status,omitempty"`
	BidOutcome                *string  `json:"bid_outcome,omitempty"`
	Team                      *string  `json:"team,omitempty"`
	ScopeType                 *string  `json:"scope_type,omitempty"`
	ActivityType              *string  `json:"activity_type,omitempty"`
	ExcelBidStatus            *string  `json:"excel_bid_status,omitempty"`
	SubmissionStatus          *string  `json:"submission_status,omitempty"`
	FinancialEvaluationStatus *string  `json:"financial_evaluation_status,omitempty"`
	POReceivedStatus          *string  `json:"po_received_status,omitempty"`
	BidResult                 *string  `json:"bid_result,omitempty"`
	// Stage tracking updates
	FinanceAlerted    *bool    `json:"finance_alerted,omitempty"`
	EMDReady          *bool    `json:"emd_ready,omitempty"`
	EMDReturned       *bool    `json:"emd_returned,omitempty"`
	BGDischarged      *bool    `json:"bg_discharged,omitempty"`
	SubmissionDone    *bool    `json:"submission_done,omitempty"`
	GemSubmissionPrice *float64 `json:"gem_submission_price,omitempty"`
	FinalPrice         *float64 `json:"final_price,omitempty"`
	TechnicalResult    *string  `json:"technical_result,omitempty"`
	DisqualificationReason *string `json:"disqualification_reason,omitempty"`
	FinancialResult    *string  `json:"financial_result,omitempty"`
	L1CompanyName      *string  `json:"l1_company_name,omitempty"`
	L1Price            *float64 `json:"l1_price,omitempty"`
	PriceDifference    *float64 `json:"price_difference,omitempty"`
	PriceDifferencePct *float64 `json:"price_difference_pct,omitempty"`
	EligibilityRemarks *string  `json:"eligibility_remarks,omitempty"`
	EMDRemarks         *string  `json:"emd_remarks,omitempty"`
	StageCompletions   map[string]bool   `json:"stage_completions,omitempty"`
	StageRemarks       map[string]string `json:"stage_remarks,omitempty"`
	StageReviews       map[string]bool   `json:"stage_reviews,omitempty"`
	PricingWorkspace   *string           `json:"pricing_workspace,omitempty"` // raw JSON string for Stage 4
}

type TransitionStageRequest struct {
	TargetStage string  `json:"target_stage" binding:"required"`
	Reason      *string `json:"reason"`
}

type AddMemberRequest struct {
	UserID string `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"required,oneof=OWNER MANAGER MEMBER REVIEWER OBSERVER"`
}

type RecordOutcomeRequest struct {
	BidOutcome    string           `json:"bid_outcome" binding:"required,oneof=WON LOST CANCELLED"`
	FinalBidValue *float64         `json:"final_bid_value"`
	L1Price       *float64         `json:"l1_price"`
	QuotedPrice   *float64         `json:"quoted_price"`
	OutcomeReason *string          `json:"outcome_reason"`
	ResultDate    *string          `json:"result_date"`
	Competitors   []CompetitorInfo `json:"competitor_info"`
}

type CompetitorInfo struct {
	Name        string   `json:"name"`
	QuotedPrice *float64 `json:"quoted_price,omitempty"`
	Rank        *string  `json:"rank,omitempty"`
}

// ────────────────────────────────────────
// Response DTOs
// ────────────────────────────────────────

type UserSummary struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
	Role     string `json:"role,omitempty"`
}

type GlobalAuditItem struct {
	ID               string      `json:"id"`
	BidID            string      `json:"bid_id"`
	BidTitle         string      `json:"bid_title"`
	FromStage        *string     `json:"from_stage,omitempty"`
	ToStage          string      `json:"to_stage"`
	TransitionReason *string     `json:"transition_reason,omitempty"`
	TransitionedBy   UserSummary `json:"transitioned_by"`
	CreatedAt        time.Time   `json:"created_at"`
}

type MemberResponse struct {
	UserID   string    `json:"user_id"`
	FullName string    `json:"full_name"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
	AddedAt  time.Time `json:"added_at"`
}

type StageHistoryResponse struct {
	ID               string      `json:"id"`
	FromStage        *string     `json:"from_stage"`
	ToStage          string      `json:"to_stage"`
	TransitionReason *string     `json:"transition_reason"`
	TransitionedBy   UserSummary `json:"transitioned_by"`
	CreatedAt        time.Time   `json:"created_at"`
}

type BidResponse struct {
	ID                     string           `json:"id"`
	BidNo                  *string          `json:"bid_no"`
	GemBidNo               *string          `json:"gem_bid_no"`
	Title                  string           `json:"title"`
	OrganizationName       *string          `json:"organization_name"`
	DepartmentName         *string          `json:"department_name"`
	PortalSource           string           `json:"portal_source"`
	CreationMode           string           `json:"creation_mode"`
	WorkflowStage          string           `json:"workflow_stage"`
	BidStatus              string           `json:"bid_status"`
	EstimatedValue         *float64         `json:"estimated_value"`
	EMDAmount              *float64         `json:"emd_amount"`
	EMDType                *string          `json:"emd_type"`
	EMDExempted            bool             `json:"emd_exempted"`
	FinalBidValue          *float64         `json:"final_bid_value"`
	L1Price                *float64         `json:"l1_price"`
	QuotedPrice            *float64         `json:"quoted_price"`
	StartDate              *time.Time       `json:"start_date"`
	EndDate                *time.Time       `json:"end_date"`
	OpeningDate            *time.Time       `json:"opening_date,omitempty"`
	ClosingDate            *time.Time       `json:"closing_date,omitempty"`
	DurationMonths         *int             `json:"duration_months"`
	Authority              *string          `json:"authority"`
	HighLevelScope         *string          `json:"high_level_scope"`
	BGRequired             bool             `json:"bg_required"`
	BGRate                 *float64         `json:"bg_rate"`
	Category               *string          `json:"category"`
	BidType                *string          `json:"bid_type"`
	GemBidType             *string          `json:"gem_bid_type"`
	QualificationStatus    string           `json:"qualification_status"`
	BidOutcome             *string          `json:"bid_outcome"`
	OutcomeReason          *string          `json:"outcome_reason"`
	TechComplianceStatus   *string          `json:"tech_compliance_status"`
	Remarks                *string          `json:"remarks"`
	CompetitorInfo         interface{}      `json:"competitor_info"`
	Metadata               interface{}      `json:"metadata"`
	BidOwner               UserSummary        `json:"bid_owner"`
	TechnicalManager       *UserSummary       `json:"technical_manager,omitempty"`
	Members                []MemberResponse   `json:"members"`
	Checklists             []BidChecklistItem `json:"checklists"`
	CreatedBy              string             `json:"created_by"`
	AISourceDocumentID     *string          `json:"ai_source_document_id,omitempty"`
	AIExtractionConfidence *float64         `json:"ai_extraction_confidence,omitempty"`
	Team                   *string          `json:"team,omitempty"`
	ScopeType              *string          `json:"scope_type,omitempty"`
	ActivityType           *string          `json:"activity_type,omitempty"`
	ExcelBidStatus         *string          `json:"excel_bid_status,omitempty"`
	SubmissionStatus       *string          `json:"submission_status,omitempty"`
	BidResult              *string          `json:"bid_result,omitempty"`
	FinanceAlerted         bool             `json:"finance_alerted"`
	EMDReady               bool             `json:"emd_ready"`
	EMDReturned            bool             `json:"emd_returned"`
	BGDischarged           bool             `json:"bg_discharged"`
	SubmissionDone         bool             `json:"submission_done"`
	GemSubmissionPrice     *float64         `json:"gem_submission_price,omitempty"`
	FinalPrice             *float64         `json:"final_price,omitempty"`
	TechnicalResult        *string          `json:"technical_result,omitempty"`
	DisqualificationReason *string          `json:"disqualification_reason,omitempty"`
	FinancialResult        *string          `json:"financial_result,omitempty"`
	L1CompanyName          *string          `json:"l1_company_name,omitempty"`
	PriceDifference        *float64         `json:"price_difference,omitempty"`
	PriceDifferencePct     *float64         `json:"price_difference_pct,omitempty"`
	EligibilityRemarks     *string          `json:"eligibility_remarks,omitempty"`
	EMDRemarks             *string          `json:"emd_remarks,omitempty"`
	StageCompletions       map[string]bool   `json:"stage_completions"`
	StageRemarks           map[string]string `json:"stage_remarks"`
	StageReviews           map[string]bool   `json:"stage_reviews"`
	PricingWorkspace       interface{}       `json:"pricing_workspace"` // Stage 4 workspace data (JSONB)
	CreatedAt              time.Time        `json:"created_at"`
	UpdatedAt              time.Time        `json:"updated_at"`
	ArchivedAt             *time.Time       `json:"archived_at"`
	ResultDate             *time.Time       `json:"result_date,omitempty"`
	DaysRemaining          *int             `json:"days_remaining,omitempty"`
}


type BidListItem struct {
	ID               string      `json:"id"`
	BidNo            *string     `json:"bid_no"`
	GemBidNo         *string     `json:"gem_bid_no"`
	Title            string      `json:"title"`
	OrganizationName *string     `json:"organization_name"`
	DepartmentName   *string     `json:"department_name"`
	PortalSource     string      `json:"portal_source"`
	Category         *string     `json:"category"`
	BidType          *string     `json:"bid_type"`
	CreationMode     string      `json:"creation_mode"`
	WorkflowStage    string      `json:"workflow_stage"`
	BidStatus        string      `json:"bid_status"`
	BidOutcome       *string     `json:"bid_outcome"`
	EstimatedValue   *float64    `json:"estimated_value"`
	EMDAmount        *float64    `json:"emd_amount"`
	EMDType          *string     `json:"emd_type"`
	OpeningDate      *time.Time  `json:"opening_date"`
	ClosingDate      *time.Time  `json:"closing_date"`
	StartDate        *time.Time  `json:"start_date,omitempty"`
	EndDate          *time.Time  `json:"end_date,omitempty"`
	OEMRequired               bool         `json:"oem_required"`
	BidOwner                  UserSummary  `json:"bid_owner"`
	TechnicalManager          *UserSummary `json:"technical_manager,omitempty"`
	Remarks                   *string     `json:"remarks"`
	Team                      *string     `json:"team,omitempty"`
	ScopeType                 *string     `json:"scope_type,omitempty"`
	BGRate                    *float64    `json:"bg_rate,omitempty"`
	ActivityType              *string     `json:"activity_type,omitempty"`
	TargetMonthDate           *time.Time  `json:"target_month_date,omitempty"`
	ExcelBidStatus            *string     `json:"excel_bid_status,omitempty"`
	SubmissionStatus          *string     `json:"submission_status,omitempty"`
	FinancialEvaluationStatus *string     `json:"financial_evaluation_status,omitempty"`
	POReceivedStatus          *string     `json:"po_received_status,omitempty"`
	EMDExempted               bool        `json:"emd_exempted"`
	SubmissionDone            bool        `json:"submission_done"`
	EMDReady                  bool        `json:"emd_ready"`
	EMDReturned               bool        `json:"emd_returned"`
	FinalBidValue             *float64    `json:"final_bid_value,omitempty"`
	TechnicalResult           *string     `json:"technical_result,omitempty"`
	FinancialResult           *string     `json:"financial_result,omitempty"`
	HasTechEval               bool        `json:"has_tech_eval"`
	BidResult                 *string     `json:"bid_result,omitempty"`
	CreatedAt                 time.Time   `json:"created_at"`
	ArchivedAt                *time.Time  `json:"archived_at,omitempty"`
	DaysRemaining             *int        `json:"days_remaining,omitempty"`
}

type BidListResponse struct {
	Bids           []BidListItem `json:"bids"`
	Total          int           `json:"total"`
	Page           int           `json:"page"`
	Limit          int           `json:"limit"`
	TotalPages     int           `json:"total_pages"`
	ActiveCount    int           `json:"active_count"`
	WonCount       int           `json:"won_count"`
	LostCount      int           `json:"lost_count"`
	CancelledCount int           `json:"cancelled_count"`
	TechEvalCount  int           `json:"tech_eval_count"`
	SubmittedCount int           `json:"submitted_count"`
}

// TenderOwnerPerformanceStat represents aggregated tender stats per user owner
type TenderOwnerPerformanceStat struct {
	UserID    string `json:"user_id"`
	FullName  string `json:"full_name"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	Total     int    `json:"total"`
	Active    int    `json:"active"`
	Submitted int    `json:"submitted"`
	TechEval  int    `json:"tech_eval"`
	FinEval   int    `json:"fin_eval"`
	Award     int    `json:"award"`
	Won       int    `json:"won"`
	Lost      int    `json:"lost"`
	Cancelled int    `json:"cancelled"`
}

// ────────────────────────────────────────
// Repository-level insert type
// ────────────────────────────────────────

type CreateBidParams struct {
	BidNo                     *string
	GemBidNo                  *string
	Title                     string
	OrganizationName          *string
	DepartmentName            *string
	PortalSource              string
	CreationMode              string
	BidOwnerID                string
	TechnicalManagerID        *string
	CreatedBy                 string
	EstimatedValue            *float64
	EMDAmount                 *float64
	EMDType                   *string
	EMDExempted               bool
	BGRequired                bool
	BGRate                    *float64
	HighLevelScope            *string
	StartDate                 *time.Time
	EndDate                   *time.Time
	DurationMonths            *int
	Authority                 *string
	Category                  *string
	BidType                   *string
	GemBidType                *string
	Remarks                   *string
	Metadata                  []byte
	Team                      *string
	ScopeType                 *string
	ActivityType              *string
	TargetMonthDate           *time.Time
	ExcelBidStatus            *string
	SubmissionStatus          *string
	FinancialEvaluationStatus *string
	POReceivedStatus          *string
	BidResult                 *string
	// AI-mode fields (nil for MANUAL)
	AISourceDocumentID     *string
	AIExtractionConfidence *float64
}

// ────────────────────────────────────────
// Query params
// ────────────────────────────────────────

type ListBidsParams struct {
	Page          int
	Limit         int
	Search        string
	WorkflowStage string
	BidStatus     string
	BidOutcome    string
	BidOwnerID    string
	Category      string
	CreationMode  string
	ClosingBefore *time.Time
	ClosingAfter  *time.Time
	OEMRequired   *bool
	InBin         bool
}
