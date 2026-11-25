package extractor

// TenderProductItem represents a product or service extracted from the RFP document.
type TenderProductItem struct {
	Name           string  `json:"name"`
	Quantity       float64 `json:"quantity"`
	Units          string  `json:"units"`
	OEMName        *string `json:"oem_name"`
	Specifications *string `json:"specifications"`
}

// ChecklistItem represents a compliance checklist item.
type ChecklistItem struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	IsMandatory bool   `json:"is_mandatory"`
}

// TenderExtractedData represents the structured tender fields extracted by the AI microservice.
type TenderExtractedData struct {
	Title                  *string             `json:"title"`
	GemBidNo               *string             `json:"gem_bid_no"`
	OrganizationName       *string             `json:"organization_name"`
	DepartmentName         *string             `json:"department_name"`
	Location               *string             `json:"location"`
	PortalSource           string              `json:"portal_source"`
	TenderLink             *string             `json:"tender_link"`
	BidType                string              `json:"bid_type"`
	Category               string              `json:"category"`
	ScopeType              string              `json:"scope_type"`
	EstimatedValue         *float64            `json:"estimated_value"`
	EmdAmount              *float64            `json:"emd_amount"`
	EmdPercentage          *float64            `json:"emd_percentage"`
	EmdFormula             *string             `json:"emd_formula"`
	EmdNotApplicable       bool                `json:"emd_not_applicable"`
	EmdExemptionTypes      []string            `json:"emd_exemption_types"`
	TenderFee              *float64            `json:"tender_fee"`
	MinimumAnnualTurnover  *float64            `json:"minimum_annual_turnover"`
	YearsOfPastExperience  *int                `json:"years_of_past_experience"`
	ContractPeriodMonths   *int                `json:"contract_period_months"`
	EvaluationMethod       *string             `json:"evaluation_method"`
	OemRequired            bool                `json:"oem_required"`
	BgRequired             bool                `json:"bg_required"`
	BgRate                 *float64            `json:"bg_rate"`
	BgDurationMonths       *int                `json:"bg_duration_months"`
	StartDate              *string             `json:"start_date"`
	EndDate                *string             `json:"end_date"`
	HighLevelScope         *string             `json:"high_level_scope"`
	EmdBankName            *string             `json:"emd_bank_name"`
	EmdBeneficiary         *string             `json:"emd_beneficiary"`
	EmdPayableAt           *string             `json:"emd_payable_at"`
	Products               []TenderProductItem `json:"products"`
	BidderChecklists       []ChecklistItem     `json:"bidder_checklists"`
	OemChecklists          []ChecklistItem     `json:"oem_checklists"`
	Remarks                *string             `json:"remarks"`
	ChallengeLabel         *string             `json:"challenge_label"`
	ChallengeText          *string             `json:"challenge_text"`
	ChallengeColor         *string             `json:"challenge_color"`
}

// AccuracyBreakdown holds the 4-pillar score breakdown.
type AccuracyBreakdown struct {
	CriticalFieldsScore         float64  `json:"critical_fields_score"`
	DataConsistencyScore        float64  `json:"data_consistency_score"`
	DocumentGroundingScore      float64  `json:"document_grounding_score"`
	StructuralCompletenessScore float64  `json:"structural_completeness_score"`
	VerifiedMatches             []string `json:"verified_matches"`
	UnverifiedFields            []string `json:"unverified_fields"`
}

// ExtractionMeta holds metadata about the file and extraction run.
type ExtractionMeta struct {
	FileName           string             `json:"filename"`
	FileType           string             `json:"file_type"`
	PagesRead          int                `json:"pages_read"`
	CharacterCount     int                `json:"character_count"`
	ExtractionTimeMs   int64              `json:"extraction_time_ms"`
	AccuracyPercentage int                `json:"accuracy_percentage"`
	AccuracyGrade      string             `json:"accuracy_grade"`
	AccuracyBreakdown  *AccuracyBreakdown `json:"accuracy_breakdown"`
	ModelUsed          string             `json:"model_used"`
}

// ExtractionResponse is the envelope returned by the API.
type ExtractionResponse struct {
	Success bool            `json:"success"`
	Data    any             `json:"data"`
	Meta    *ExtractionMeta `json:"meta"`
}
