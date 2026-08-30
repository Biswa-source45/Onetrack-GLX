package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/bid/domain"
)

type bidService struct {
	repo     domain.BidRepository
	alertSvc alertDomain.AlertService
}

func NewBidService(repo domain.BidRepository, alertSvc alertDomain.AlertService) domain.BidService {
	return &bidService{
		repo:     repo,
		alertSvc: alertSvc,
	}
}

func getRoleForStage(stage string) string {
	switch stage {
	case domain.StageDiscovered, domain.StageOEMAuthorizationRequest, domain.StagePricingRequest:
		return "PRE_SALES"
	case domain.StageDocumentChecklistPrep, domain.StageTechnicalEvaluation:
		return "TECHNICAL"
	case domain.StageEMDProcessing, domain.StageFinancialEvaluation:
		return "FINANCE"
	case domain.StageInternalApproval, domain.StageAwardHandover:
		return "MANAGEMENT"
	default:
		return "ALL"
	}
}

// validateEMDDetails enforces that the EMD bank/DD detail fields required for a
// given payment mode are actually present, using the merged (new-or-existing)
// values so it works for both full creates and partial updates.
func validateEMDDetails(exempted bool, emdType string, bankName, accountNumber, ifscCode, beneficiary, payableAt *string) error {
	if exempted {
		return nil
	}
	nonEmpty := func(s *string) bool { return s != nil && strings.TrimSpace(*s) != "" }
	switch emdType {
	case "ONLINE":
		var missing []string
		if !nonEmpty(bankName) {
			missing = append(missing, "emd_bank_name")
		}
		if !nonEmpty(accountNumber) {
			missing = append(missing, "emd_account_number")
		}
		if !nonEmpty(ifscCode) {
			missing = append(missing, "emd_ifsc_code")
		}
		if len(missing) > 0 {
			return fmt.Errorf("%w: %s required for Online EMD", domain.ErrValidation, strings.Join(missing, ", "))
		}
	case "DD":
		var missing []string
		if !nonEmpty(beneficiary) {
			missing = append(missing, "emd_beneficiary")
		}
		if !nonEmpty(payableAt) {
			missing = append(missing, "emd_payable_at")
		}
		if len(missing) > 0 {
			return fmt.Errorf("%w: %s required for DD EMD", domain.ErrValidation, strings.Join(missing, ", "))
		}
	}
	return nil
}

// validateEMDExemption enforces that an EMD-exempt tender records *why* it's
// exempt: MSME or STARTUP need no further detail, OTHER requires a non-empty
// free-text reason. No-op when the tender isn't exempt.
func validateEMDExemption(exempted bool, exemptionType string, exemptionReason *string) error {
	if !exempted {
		return nil
	}
	switch exemptionType {
	case "MSME", "STARTUP":
		return nil
	case "OTHER":
		if exemptionReason == nil || strings.TrimSpace(*exemptionReason) == "" {
			return fmt.Errorf("%w: emd_exemption_reason required when emd_exemption_type is OTHER", domain.ErrValidation)
		}
		return nil
	default:
		return fmt.Errorf("%w: emd_exemption_type required (MSME, STARTUP, or OTHER) when emd_exempted is true", domain.ErrValidation)
	}
}

// validateEMDMutualExclusivity enforces that a tender is never simultaneously
// "EMD Exempted" (an EMD is required but we're excused from paying it) and
// "EMD Not Applicable" (the tender has no EMD clause at all) — these are two
// distinct, unrelated facts about a tender and can't both be true.
func validateEMDMutualExclusivity(exempted, notApplicable bool) error {
	if exempted && notApplicable {
		return fmt.Errorf("%w: a tender cannot be both emd_exempted and emd_not_applicable — choose one", domain.ErrValidation)
	}
	return nil
}

// ensureIdentifierFree rejects a tender identifier that another live tender
// already carries. The GeM bid number / RFP number is the tender's real-world
// key, so duplicates would leave the team with two records for one tender.
// excludeID is the tender being edited, so it never collides with itself.
func (s *bidService) ensureIdentifierFree(ctx context.Context, identifier *string, excludeID string) error {
	if identifier == nil || strings.TrimSpace(*identifier) == "" {
		return nil
	}
	match, err := s.repo.FindByIdentifier(ctx, *identifier, excludeID)
	if err != nil {
		return err
	}
	if match != nil {
		return fmt.Errorf("%w: %q is already used by tender %q", domain.ErrDuplicateIdentifier,
			strings.TrimSpace(*identifier), match.Title)
	}
	return nil
}

func (s *bidService) CreateBid(ctx context.Context, req *domain.CreateBidRequest, createdBy string) (*domain.BidResponse, error) {
	emdExempted := req.EMDExempted != nil && *req.EMDExempted
	emdNotApplicable := req.EMDNotApplicable != nil && *req.EMDNotApplicable
	if err := validateEMDMutualExclusivity(emdExempted, emdNotApplicable); err != nil {
		return nil, err
	}
	emdType := ""
	if req.EMDType != nil {
		emdType = *req.EMDType
	}
	if err := validateEMDDetails(emdExempted || emdNotApplicable, emdType, req.EMDBankName, req.EMDAccountNumber, req.EMDIFSCCode, req.EMDBeneficiary, req.EMDPayableAt); err != nil {
		return nil, err
	}
	exemptionType := ""
	if req.EMDExemptionType != nil {
		exemptionType = *req.EMDExemptionType
	}
	if err := validateEMDExemption(emdExempted, exemptionType, req.EMDExemptionReason); err != nil {
		return nil, err
	}

	// A tender is identified by its GeM bid number or RFP number; reject a
	// create that would duplicate one that already exists.
	if err := s.ensureIdentifierFree(ctx, req.GemBidNo, ""); err != nil {
		return nil, err
	}
	if err := s.ensureIdentifierFree(ctx, req.BidNo, ""); err != nil {
		return nil, err
	}

	params := &domain.CreateBidParams{
		BidNo:              req.BidNo,
		GemBidNo:           req.GemBidNo,
		Title:              req.Title,
		OrganizationName:   req.OrganizationName,
		DepartmentName:     req.DepartmentName,
		PortalSource:       "GeM",
		CreationMode:       req.CreationMode,
		BidOwnerID:         req.BidOwnerID,
		ReportingManagerID: req.ReportingManagerID,
		CreatedBy:          createdBy,
		EstimatedValue:     req.EstimatedValue,
		EMDAmount:          req.EMDAmount,
		EMDType:            req.EMDType,
		Category:           req.Category,
		Quantity:           req.Quantity,
		OurRank:            req.OurRank,
		BidType:            req.BidType,
		GemBidType:         req.GemBidType,
		Remarks:            req.Remarks,
		Metadata:           []byte(`{"stage_completions":{"DISCOVERED":true}}`),
	}

	if req.PortalSource != nil {
		params.PortalSource = *req.PortalSource
	}
	if req.EMDExempted != nil {
		params.EMDExempted = *req.EMDExempted
	}
	if req.EMDNotApplicable != nil {
		params.EMDNotApplicable = *req.EMDNotApplicable
	}
	if params.EMDExempted {
		params.EMDExemptionType = req.EMDExemptionType
		params.EMDExemptionReason = req.EMDExemptionReason
	}
	if req.BGRequired != nil {
		params.BGRequired = *req.BGRequired
	}
	startDateStr := req.StartDate
	if startDateStr == nil {
		startDateStr = req.OpeningDate
	}
	if startDateStr != nil {
		t, err := time.Parse(time.RFC3339, *startDateStr)
		if err == nil {
			params.StartDate = &t
		}
	}

	endDateStr := req.EndDate
	if endDateStr == nil {
		endDateStr = req.ClosingDate
	}
	if endDateStr != nil {
		t, err := time.Parse(time.RFC3339, *endDateStr)
		if err == nil {
			params.EndDate = &t
			// Auto-calculate duration months from end date
			if params.StartDate != nil {
				months := int(params.EndDate.Sub(*params.StartDate).Hours()/24/30) + 1
				params.DurationMonths = &months
			}
		}
	}
	if req.DurationMonths != nil {
		params.DurationMonths = req.DurationMonths
	}
	if req.HighLevelScope != nil {
		params.HighLevelScope = req.HighLevelScope
	}
	if req.Authority != nil {
		params.Authority = req.Authority
	}
	if req.Metadata != nil {
		params.Metadata = []byte(*req.Metadata)
	}

	params.BGRate = req.BGRate
	params.Team = req.Team
	params.ScopeType = req.ScopeType
	params.ActivityType = req.ActivityType
	params.ExcelBidStatus = req.ExcelBidStatus
	params.SubmissionStatus = req.SubmissionStatus
	params.FinancialEvaluationStatus = req.FinancialEvaluationStatus
	params.POReceivedStatus = req.POReceivedStatus
	params.BidResult = req.BidResult
	// EMD bank / DD detail fields
	params.EMDBankName = req.EMDBankName
	params.EMDAccountNumber = req.EMDAccountNumber
	params.EMDIFSCCode = req.EMDIFSCCode
	params.EMDBranch = req.EMDBranch
	params.EMDBeneficiary = req.EMDBeneficiary
	params.EMDPayableAt = req.EMDPayableAt

	id, err := s.repo.Create(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("create bid: %w", err)
	}

	// Record initial stage history
	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:          id,
		ToStage:        domain.StageDiscovered,
		TransitionedBy: createdBy,
	})

	// Auto-add bid owner as OWNER member
	_ = s.repo.AddMember(ctx, id, req.BidOwnerID, "OWNER", createdBy)

	// Auto-add reporting manager as MANAGER member if set
	if req.ReportingManagerID != nil {
		_ = s.repo.AddMember(ctx, id, *req.ReportingManagerID, "MANAGER", createdBy)
	}

	// Dispatch alert & email notification for new tender creation
	if s.alertSvc != nil {
		bidIdCopy := id
		gemBidNoStr := "N/A"
		if req.GemBidNo != nil && *req.GemBidNo != "" {
			gemBidNoStr = *req.GemBidNo
		} else if req.BidNo != nil && *req.BidNo != "" {
			gemBidNoStr = *req.BidNo
		}

		_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			TargetRole: "PRE_SALES",
			BidID:      &bidIdCopy,
			CreatedBy:  &createdBy,
			Type:       "TENDER_CREATED",
			Title:      fmt.Sprintf("New Tender Identified: %s", req.Title),
			Message:    fmt.Sprintf("Tender '%s' (GeM Bid No: %s) has been created and assigned for Stage 2 (Eligibility Assessment).", req.Title, gemBidNoStr),
		})

		// Directly notify the Reporting Manager (in-app alert + email, via the
		// same CreateAlert -> dispatchAlertEmails path) that they've been
		// assigned to a newly discovered tender — distinct from the PRE_SALES
		// broadcast above, which doesn't target any specific person.
		if req.ReportingManagerID != nil {
			_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
				UserID:    req.ReportingManagerID,
				BidID:     &bidIdCopy,
				CreatedBy: &createdBy,
				Type:      "TENDER_ASSIGNED_REPORTING_MANAGER",
				Title:     fmt.Sprintf("New Tender Discovered: %s", req.Title),
				Message:   fmt.Sprintf("You've been assigned as Reporting Manager for tender '%s' (GeM Bid No: %s). Please review.", req.Title, gemBidNoStr),
			})
		}

		// EMD processing alert is NOT sent automatically here — it must be
		// manually triggered by an authorized user (Bid Executive/Manager/Admin)
		// from Stage 6's "Alert Finance Team" action once EMD is actually ready
		// to be processed. Finance is intentionally excluded from triggering
		// their own alert (see Stage6Workspace's canTriggerEmdAlert gate).
	}

	// Seed Bidder doc checklists (group=BIDDER)
	if len(req.BidderChecklists) > 0 {
		_ = s.repo.BulkInsertChecklistsWithGroup(ctx, id, req.BidderChecklists, "BIDDER")
	}
	// Seed OEM doc checklists (group=OEM)
	if len(req.OEMChecklists) > 0 {
		_ = s.repo.BulkInsertChecklistsWithGroup(ctx, id, req.OEMChecklists, "OEM")
	}
	// Legacy checklists support (only run if specific bidder/oem arrays are empty)
	if len(req.Checklists) > 0 && len(req.BidderChecklists) == 0 && len(req.OEMChecklists) == 0 {
		_ = s.repo.BulkInsertChecklists(ctx, id, req.Checklists)
	}

	return s.GetBid(ctx, id)
}

func (s *bidService) GetBid(ctx context.Context, id string) (*domain.BidResponse, error) {
	bid, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	owner, err := s.repo.GetUserSummary(ctx, bid.BidOwnerID)
	if err != nil {
		owner = &domain.UserSummary{ID: bid.BidOwnerID}
	}

	var reportingManager *domain.UserSummary
	if bid.ReportingManagerID != nil {
		rm, err := s.repo.GetUserSummary(ctx, *bid.ReportingManagerID)
		if err == nil {
			reportingManager = rm
		}
	}

	members, err := s.repo.GetMembers(ctx, id)
	if err != nil {
		members = []domain.MemberResponse{}
	}

	checklists, err := s.repo.GetChecklists(ctx, id)
	if err != nil {
		checklists = []domain.BidChecklist{}
	}

	checklistItems := make([]domain.BidChecklistItem, 0, len(checklists))
	for _, c := range checklists {
		item := domain.BidChecklistItem{
			ID:        c.ID,
			Title:     c.Title,
			IsDone:    c.IsDone,
			DoneAt:    c.DoneAt,
			SortOrder: c.SortOrder,
			CreatedAt: c.CreatedAt,
		}
		if c.DoneBy != nil {
			u, err := s.repo.GetUserSummary(ctx, *c.DoneBy)
			if err == nil {
				item.DoneBy = u
			}
		}
		checklistItems = append(checklistItems, item)
	}

	return buildBidResponse(bid, owner, reportingManager, members, checklistItems), nil
}

func (s *bidService) GetChecklists(ctx context.Context, bidID string) ([]domain.BidChecklistItem, error) {
	checklists, err := s.repo.GetChecklists(ctx, bidID)
	if err != nil {
		return nil, err
	}
	items := make([]domain.BidChecklistItem, 0, len(checklists))
	for _, c := range checklists {
		item := domain.BidChecklistItem{
			ID:        c.ID,
			Title:     c.Title,
			IsDone:    c.IsDone,
			DoneAt:    c.DoneAt,
			SortOrder: c.SortOrder,
			CreatedAt: c.CreatedAt,
		}
		if c.DoneBy != nil {
			u, _ := s.repo.GetUserSummary(ctx, *c.DoneBy)
			item.DoneBy = u
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *bidService) AddChecklist(ctx context.Context, bidID string, req *domain.AddChecklistRequest) (*domain.BidChecklistItem, error) {
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	} else {
		existing, err := s.repo.GetChecklists(ctx, bidID)
		if err == nil {
			sortOrder = len(existing)
		}
	}
	c, err := s.repo.AddChecklist(ctx, bidID, req.Title, sortOrder)
	if err != nil {
		return nil, err
	}
	return &domain.BidChecklistItem{
		ID:        c.ID,
		Title:     c.Title,
		IsDone:    c.IsDone,
		SortOrder: c.SortOrder,
		CreatedAt: c.CreatedAt,
	}, nil
}

func (s *bidService) UpdateChecklist(ctx context.Context, bidID string, checklistID string, req *domain.UpdateChecklistRequest) (*domain.BidChecklistItem, error) {
	if err := s.repo.UpdateChecklist(ctx, checklistID, req.Title, req.SortOrder); err != nil {
		return nil, err
	}
	checklists, err := s.repo.GetChecklists(ctx, bidID)
	if err != nil {
		return nil, err
	}
	for _, c := range checklists {
		if c.ID == checklistID {
			item := &domain.BidChecklistItem{
				ID:        c.ID,
				Title:     c.Title,
				IsDone:    c.IsDone,
				DoneAt:    c.DoneAt,
				SortOrder: c.SortOrder,
				CreatedAt: c.CreatedAt,
			}
			if c.DoneBy != nil {
				u, _ := s.repo.GetUserSummary(ctx, *c.DoneBy)
				item.DoneBy = u
			}
			return item, nil
		}
	}
	return nil, fmt.Errorf("checklist item not found")
}

func (s *bidService) DeleteChecklist(ctx context.Context, bidID string, checklistID string) error {
	return s.repo.DeleteChecklist(ctx, checklistID)
}

func (s *bidService) ReorderChecklists(ctx context.Context, bidID string, req *domain.ReorderChecklistRequest) ([]domain.BidChecklistItem, error) {
	if err := s.repo.ReorderChecklists(ctx, req.Items); err != nil {
		return nil, err
	}
	return s.GetChecklists(ctx, bidID)
}

func (s *bidService) ToggleChecklist(ctx context.Context, bidID string, checklistID string, isDone bool, actorID string) (*domain.BidChecklistItem, error) {
	if err := s.repo.ToggleChecklist(ctx, checklistID, isDone, actorID); err != nil {
		return nil, err
	}
	checklists, err := s.repo.GetChecklists(ctx, bidID)
	if err != nil {
		return nil, err
	}
	for _, c := range checklists {
		if c.ID == checklistID {
			item := &domain.BidChecklistItem{
				ID:        c.ID,
				Title:     c.Title,
				IsDone:    c.IsDone,
				DoneAt:    c.DoneAt,
				SortOrder: c.SortOrder,
				CreatedAt: c.CreatedAt,
			}
			if c.DoneBy != nil {
				u, _ := s.repo.GetUserSummary(ctx, *c.DoneBy)
				item.DoneBy = u
			}
			return item, nil
		}
	}
	return nil, fmt.Errorf("checklist item not found")
}

func (s *bidService) ListBids(ctx context.Context, params domain.ListBidsParams) (*domain.BidListResponse, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	// Clamp rather than reset: an oversized request used to silently fall back
	// to 20, so a caller asking for 200 got a fifth of what it expected and
	// reported totals from a truncated list.
	if params.Limit < 1 {
		params.Limit = 20
	}
	if params.Limit > 100 {
		params.Limit = 100
	}

	bids, total, statusCounts, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, err
	}

	items := make([]domain.BidListItem, 0, len(bids))
	for _, b := range bids {
		owner, _ := s.repo.GetUserSummary(ctx, b.BidOwnerID)
		if owner == nil {
			owner = &domain.UserSummary{ID: b.BidOwnerID}
		}
		items = append(items, buildBidListItem(&b, owner))
	}

	return &domain.BidListResponse{
		Bids:           items,
		Total:          total,
		Page:           params.Page,
		Limit:          params.Limit,
		TotalPages:     int(math.Ceil(float64(total) / float64(params.Limit))),
		ActiveCount:    statusCounts["ACTIVE"],
		WonCount:       statusCounts["WON"],
		LostCount:      statusCounts["LOST"],
		CancelledCount: statusCounts["CANCELLED"],
		ClosedCount:    statusCounts["CLOSED"],
		TechEvalCount:  statusCounts["TECHNICAL_EVALUATION"],
		SubmittedCount: statusCounts["SUBMITTED"],
	}, nil
}

func (s *bidService) UpdateBid(ctx context.Context, id string, req *domain.UpdateBidRequest, actorID string) error {
	bid, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if actorID == "" {
		actorID = "SYSTEM"
	}

	// Changing a tender's identifier must not collide with another tender.
	if err := s.ensureIdentifierFree(ctx, req.GemBidNo, id); err != nil {
		return err
	}
	if err := s.ensureIdentifierFree(ctx, req.BidNo, id); err != nil {
		return err
	}

	// Validate EMD detail fields against the merged (request-or-existing) state,
	// since this is a partial update and a field omitted from req may already be set.
	mergedEMDExempted := bid.EMDExempted
	if req.EMDExempted != nil {
		mergedEMDExempted = *req.EMDExempted
	}
	mergedEMDNotApplicable := bid.EMDNotApplicable
	if req.EMDNotApplicable != nil {
		mergedEMDNotApplicable = *req.EMDNotApplicable
	}
	// A client turning one flag on explicitly always wins over a stale opposite
	// flag left on the existing row, so switching categories only requires
	// sending the one field that's changing.
	if req.EMDExempted != nil && mergedEMDExempted && mergedEMDNotApplicable {
		mergedEMDNotApplicable = false
		cleared := false
		req.EMDNotApplicable = &cleared
	} else if req.EMDNotApplicable != nil && mergedEMDNotApplicable && mergedEMDExempted {
		mergedEMDExempted = false
		cleared := false
		req.EMDExempted = &cleared
	}
	if err := validateEMDMutualExclusivity(mergedEMDExempted, mergedEMDNotApplicable); err != nil {
		return err
	}
	mergedEMDType := ""
	if bid.EMDType != nil {
		mergedEMDType = *bid.EMDType
	}
	if req.EMDType != nil {
		mergedEMDType = *req.EMDType
	}
	mergedBankName := bid.EMDBankName
	if req.EMDBankName != nil {
		mergedBankName = req.EMDBankName
	}
	mergedAccountNumber := bid.EMDAccountNumber
	if req.EMDAccountNumber != nil {
		mergedAccountNumber = req.EMDAccountNumber
	}
	mergedIFSCCode := bid.EMDIFSCCode
	if req.EMDIFSCCode != nil {
		mergedIFSCCode = req.EMDIFSCCode
	}
	mergedBeneficiary := bid.EMDBeneficiary
	if req.EMDBeneficiary != nil {
		mergedBeneficiary = req.EMDBeneficiary
	}
	mergedPayableAt := bid.EMDPayableAt
	if req.EMDPayableAt != nil {
		mergedPayableAt = req.EMDPayableAt
	}
	if err := validateEMDDetails(mergedEMDExempted || mergedEMDNotApplicable, mergedEMDType, mergedBankName, mergedAccountNumber, mergedIFSCCode, mergedBeneficiary, mergedPayableAt); err != nil {
		return err
	}

	mergedExemptionType := bid.EMDExemptionType
	if req.EMDExemptionType != nil {
		mergedExemptionType = req.EMDExemptionType
	}
	mergedExemptionReason := bid.EMDExemptionReason
	if req.EMDExemptionReason != nil {
		mergedExemptionReason = req.EMDExemptionReason
	}
	mergedExemptionTypeStr := ""
	if mergedExemptionType != nil {
		mergedExemptionTypeStr = *mergedExemptionType
	}
	if err := validateEMDExemption(mergedEMDExempted, mergedExemptionTypeStr, mergedExemptionReason); err != nil {
		return err
	}
	// If exemption was just turned off (including by switching to Not Applicable
	// above), clear the stale type/reason.
	if !mergedEMDExempted {
		cleared := ""
		req.EMDExemptionType = &cleared
		req.EMDExemptionReason = &cleared
	}
	// If Not Applicable was just turned off and emd_type is still stuck on its
	// sentinel value, reset it so the tender doesn't display "NOT APPLICABLE"
	// as its payment mode while the flag says otherwise.
	if !mergedEMDNotApplicable && mergedEMDType == "NOT_APPLICABLE" && req.EMDType == nil {
		resetType := "ONLINE"
		req.EMDType = &resetType
	}

	// Build human-readable audit change summaries for field changes
	var changes []string

	if req.Title != nil && *req.Title != bid.Title {
		changes = append(changes, fmt.Sprintf("Title: '%s' → '%s'", bid.Title, *req.Title))
	}
	if req.EstimatedValue != nil {
		oldVal := 0.0
		if bid.EstimatedValue != nil {
			oldVal = *bid.EstimatedValue
		}
		if *req.EstimatedValue != oldVal {
			changes = append(changes, fmt.Sprintf("Est Value: ₹%.2f → ₹%.2f", oldVal, *req.EstimatedValue))
		}
	}
	if req.EMDAmount != nil {
		oldVal := 0.0
		if bid.EMDAmount != nil {
			oldVal = *bid.EMDAmount
		}
		if *req.EMDAmount != oldVal {
			changes = append(changes, fmt.Sprintf("EMD Amount: ₹%.2f → ₹%.2f", oldVal, *req.EMDAmount))
		}
	}
	if req.GemSubmissionPrice != nil {
		oldVal := 0.0
		if bid.GemSubmissionPrice != nil {
			oldVal = *bid.GemSubmissionPrice
		}
		if *req.GemSubmissionPrice != oldVal {
			changes = append(changes, fmt.Sprintf("Submitted Price: ₹%.2f → ₹%.2f", oldVal, *req.GemSubmissionPrice))
		}
	}
	if req.FinalPrice != nil {
		oldVal := 0.0
		if bid.FinalPrice != nil {
			oldVal = *bid.FinalPrice
		}
		if *req.FinalPrice != oldVal {
			changes = append(changes, fmt.Sprintf("Final Price: ₹%.2f → ₹%.2f", oldVal, *req.FinalPrice))
		}
	}
	if req.L1Price != nil {
		oldVal := 0.0
		if bid.L1Price != nil {
			oldVal = *bid.L1Price
		}
		if *req.L1Price != oldVal {
			changes = append(changes, fmt.Sprintf("L1 Price: ₹%.2f → ₹%.2f", oldVal, *req.L1Price))
		}
	}
	if req.Category != nil {
		oldCat := "—"
		if bid.Category != nil {
			oldCat = *bid.Category
		}
		if *req.Category != oldCat {
			changes = append(changes, fmt.Sprintf("Category: '%s' → '%s'", oldCat, *req.Category))
		}
	}
	if req.PortalSource != nil && *req.PortalSource != bid.PortalSource {
		changes = append(changes, fmt.Sprintf("Portal Source: '%s' → '%s'", bid.PortalSource, *req.PortalSource))
	}
	if req.DepartmentName != nil {
		oldDept := "—"
		if bid.DepartmentName != nil {
			oldDept = *bid.DepartmentName
		}
		if *req.DepartmentName != oldDept {
			changes = append(changes, fmt.Sprintf("Department: '%s' → '%s'", oldDept, *req.DepartmentName))
		}
	}
	if req.POReceivedStatus != nil {
		oldStatus := "Pending"
		if bid.POReceivedStatus != nil {
			oldStatus = *bid.POReceivedStatus
		}
		if *req.POReceivedStatus != oldStatus {
			changes = append(changes, fmt.Sprintf("PO Received Status: '%s' → '%s'", oldStatus, *req.POReceivedStatus))
		}
	}
	if req.Team != nil {
		oldTeam := "—"
		if bid.Team != nil {
			oldTeam = *bid.Team
		}
		if *req.Team != oldTeam {
			changes = append(changes, fmt.Sprintf("Team: '%s' → '%s'", oldTeam, *req.Team))
		}
	}
	if req.ScopeType != nil {
		oldScope := "—"
		if bid.ScopeType != nil {
			oldScope = *bid.ScopeType
		}
		if *req.ScopeType != oldScope {
			changes = append(changes, fmt.Sprintf("Scope Type: '%s' → '%s'", oldScope, *req.ScopeType))
		}
	}

	// Automate transition to LOST when technical_result is DISQUALIFIED during Technical Evaluation stage
	if req.TechnicalResult != nil && *req.TechnicalResult == "DISQUALIFIED" {
		lost := "LOST"
		req.BidStatus = &lost
		req.BidOutcome = &lost
		if bid.WorkflowStage != "LOST" {
			prevStage := bid.WorkflowStage
			reason := "Disqualified in Technical Evaluation"
			if req.DisqualificationReason != nil && *req.DisqualificationReason != "" {
				reason = fmt.Sprintf("Disqualified in Technical Eval: %s", *req.DisqualificationReason)
			}
			_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
				BidID:            id,
				FromStage:        &prevStage,
				ToStage:          "LOST",
				TransitionReason: &reason,
				TransitionedBy:   actorID,
			})
			_ = s.repo.UpdateStage(ctx, id, "LOST", "LOST")
		}
	}

	if err := s.repo.Update(ctx, id, req); err != nil {
		return err
	}

	if len(changes) > 0 {
		reason := strings.Join(changes, " | ")
		toStage := bid.WorkflowStage
		if req.WorkflowStage != nil {
			toStage = *req.WorkflowStage
		}
		_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
			BidID:            id,
			FromStage:        &bid.WorkflowStage,
			ToStage:          toStage,
			TransitionReason: &reason,
			TransitionedBy:   actorID,
		})
	}

	return nil
}

func (s *bidService) GetGlobalAuditLogs(ctx context.Context, limit int) ([]domain.GlobalAuditItem, error) {
	return s.repo.GetGlobalAuditLogs(ctx, limit)
}

func (s *bidService) GetTenderPerformanceMatrix(ctx context.Context, ownerID string) ([]domain.TenderOwnerPerformanceStat, error) {
	return s.repo.GetTenderPerformanceMatrix(ctx, ownerID)
}

func (s *bidService) TransitionStage(ctx context.Context, id string, req *domain.TransitionStageRequest, actorID string) (*domain.TransitionResult, error) {
	bid, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if IsTerminalStage(bid.WorkflowStage) {
		if bid.WorkflowStage != domain.StageCancelled || IsTerminalStage(req.TargetStage) {
			return nil, fmt.Errorf("bid is in a terminal stage: %s", bid.WorkflowStage)
		}
	}

	if !IsTransitionAllowed(bid.CreationMode, bid.WorkflowStage, req.TargetStage) {
		return nil, fmt.Errorf("transition from %s to %s is not allowed for %s mode",
			bid.WorkflowStage, req.TargetStage, bid.CreationMode)
	}

	// Determine bid_status update
	newStatus := domain.BidStatusActive
	switch req.TargetStage {
	case domain.StageWon:
		newStatus = domain.BidStatusWon
	case domain.StageLost:
		newStatus = domain.BidStatusLost
	case domain.StageCancelled:
		newStatus = domain.BidStatusCancelled
	}

	prevStage := bid.WorkflowStage

	// workflow_stage index tracking (used for history/validation only)
	prevIdx := -1
	targetIdx := -1
	for i, st := range domain.OrderedWorkflowStages {
		if st == prevStage {
			prevIdx = i
		}
		if st == req.TargetStage {
			targetIdx = i
		}
	}
	_, _ = prevIdx, targetIdx // retained for auditing

	if err := s.repo.UpdateStage(ctx, id, req.TargetStage, newStatus); err != nil {
		return nil, fmt.Errorf("update stage: %w", err)
	}

	// NOTE: stage_completions is intentionally NOT modified here.
	// Each stage's completion status is managed atomically via PATCH /bids/:id
	// from the frontend CompleteStageModal. Mixing workflow_stage transitions
	// with stage_completions updates caused cascade completion bugs.

	reasonText := ""
	if req.Reason != nil {
		reasonText = *req.Reason
	}

	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            id,
		FromStage:        &prevStage,
		ToStage:          req.TargetStage,
		TransitionReason: req.Reason,
		TransitionedBy:   actorID,
	})

	// Dispatch automated alert & email to relevant team role
	if s.alertSvc != nil {
		targetRole := getRoleForStage(req.TargetStage)
		bidIdCopy := id
		_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			TargetRole: targetRole,
			BidID:      &bidIdCopy,
			CreatedBy:  &actorID,
			Type:       fmt.Sprintf("STAGE_TRANSITION_%s", req.TargetStage),
			Title:      fmt.Sprintf("Tender Advanced: %s", req.TargetStage),
			Message:    fmt.Sprintf("Tender '%s' stage transitioned to %s. Remarks: %s", bid.Title, req.TargetStage, reasonText),
		})
	}

	return &domain.TransitionResult{
		BidID:          id,
		PreviousStage:  prevStage,
		CurrentStage:   req.TargetStage,
		TransitionedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (s *bidService) GetStageHistory(ctx context.Context, id string) ([]domain.StageHistoryResponse, error) {
	history, err := s.repo.GetStageHistory(ctx, id)
	if err != nil {
		return nil, err
	}

	result := make([]domain.StageHistoryResponse, 0, len(history))
	for _, h := range history {
		actor, _ := s.repo.GetUserSummary(ctx, h.TransitionedBy)
		if actor == nil {
			actor = &domain.UserSummary{ID: h.TransitionedBy}
		}
		result = append(result, domain.StageHistoryResponse{
			ID:               h.ID,
			FromStage:        h.FromStage,
			ToStage:          h.ToStage,
			TransitionReason: h.TransitionReason,
			TransitionedBy:   *actor,
			EventType:        h.EventType,
			Details:          h.Details,
			CreatedAt:        h.CreatedAt,
		})
	}
	return result, nil
}

// AddMicroEvent persists a granular audit event (pricing change, alert sent,
// OEM/checklist edit, EMD confirmation, etc.) to the shared stage-history
// table so every user sees it — not just the browser that performed it.
func (s *bidService) AddMicroEvent(ctx context.Context, bidID string, req *domain.AddMicroEventRequest, actorID string) (*domain.StageHistoryResponse, error) {
	if _, err := s.repo.GetByID(ctx, bidID); err != nil {
		return nil, err
	}

	toStage := req.ToStage
	if toStage == "" {
		toStage = "MICRO_EVENT"
	}
	eventType := req.EventType
	h := &domain.BidStageHistory{
		BidID:            bidID,
		FromStage:        req.FromStage,
		ToStage:          toStage,
		TransitionReason: req.TransitionReason,
		TransitionedBy:   actorID,
		EventType:        &eventType,
		Details:          req.Details,
	}
	if err := s.repo.AddStageHistory(ctx, h); err != nil {
		return nil, err
	}

	actor, _ := s.repo.GetUserSummary(ctx, actorID)
	if actor == nil {
		actor = &domain.UserSummary{ID: actorID}
	}
	return &domain.StageHistoryResponse{
		FromStage:        h.FromStage,
		ToStage:          h.ToStage,
		TransitionReason: h.TransitionReason,
		TransitionedBy:   *actor,
		EventType:        h.EventType,
		Details:          h.Details,
		CreatedAt:        time.Now(),
	}, nil
}

func (s *bidService) AddMember(ctx context.Context, bidID string, req *domain.AddMemberRequest, actorID string) error {
	_, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return err
	}
	return s.repo.AddMember(ctx, bidID, req.UserID, req.Role, actorID)
}

func (s *bidService) RemoveMember(ctx context.Context, bidID string, userID string) error {
	return s.repo.RemoveMember(ctx, bidID, userID)
}

func (s *bidService) RecordOutcome(ctx context.Context, id string, req *domain.RecordOutcomeRequest) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.UpdateOutcome(ctx, id, req)
}

func (s *bidService) ArchiveBid(ctx context.Context, id string) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.SoftDelete(ctx, id)
}

func (s *bidService) RestoreBid(ctx context.Context, id string) error {
	bid, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	// Binning a tender frees its identifier, so another tender may have taken it
	// while this one sat in the bin. Restoring blindly would put two live
	// tenders on the same GeM/RFP number - the exact thing the identifier is
	// meant to prevent - so the conflict is reported instead.
	if err := s.ensureIdentifierFree(ctx, bid.GemBidNo, id); err != nil {
		return err
	}
	if err := s.ensureIdentifierFree(ctx, bid.BidNo, id); err != nil {
		return err
	}

	return s.repo.Restore(ctx, id)
}

func (s *bidService) PermanentDeleteBid(ctx context.Context, id string) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.PermanentDelete(ctx, id)
}

// ────────────────────────────────────────
// Response builders
// ────────────────────────────────────────

func buildBidResponse(bid *domain.BidWorkspace, owner *domain.UserSummary, reportingManager *domain.UserSummary, members []domain.MemberResponse, checklists []domain.BidChecklistItem) *domain.BidResponse {
	var competitorInfo interface{} = []interface{}{}
	var metadata interface{} = map[string]interface{}{}

	if len(bid.CompetitorInfo) > 0 {
		_ = json.Unmarshal(bid.CompetitorInfo, &competitorInfo)
	}
	if len(bid.Metadata) > 0 {
		_ = json.Unmarshal(bid.Metadata, &metadata)
	}

	var completions map[string]bool = make(map[string]bool)
	var remarks map[string]string = make(map[string]string)
	var reviews map[string]bool = make(map[string]bool)
	if len(bid.StageCompletions) > 0 {
		_ = json.Unmarshal(bid.StageCompletions, &completions)
	}
	if len(bid.StageRemarks) > 0 {
		_ = json.Unmarshal(bid.StageRemarks, &remarks)
	}
	if len(bid.StageReviews) > 0 {
		_ = json.Unmarshal(bid.StageReviews, &reviews)
	}

	var pricingWorkspace interface{}
	if len(bid.PricingWorkspace) > 0 {
		_ = json.Unmarshal(bid.PricingWorkspace, &pricingWorkspace)
	}

	var oemWorkspace interface{}
	if len(bid.OEMWorkspace) > 0 {
		_ = json.Unmarshal(bid.OEMWorkspace, &oemWorkspace)
	}

	return &domain.BidResponse{
		ID:                        bid.ID,
		BidNo:                     bid.BidNo,
		GemBidNo:                  bid.GemBidNo,
		Title:                     bid.Title,
		OrganizationName:          bid.OrganizationName,
		DepartmentName:            bid.DepartmentName,
		PortalSource:              bid.PortalSource,
		CreationMode:              bid.CreationMode,
		WorkflowStage:             bid.WorkflowStage,
		BidStatus:                 bid.BidStatus,
		EstimatedValue:            bid.EstimatedValue,
		EMDAmount:                 bid.EMDAmount,
		EMDType:                   bid.EMDType,
		EMDExempted:               bid.EMDExempted,
		EMDNotApplicable:          bid.EMDNotApplicable,
		EMDExemptionType:          bid.EMDExemptionType,
		EMDExemptionReason:        bid.EMDExemptionReason,
		FinalBidValue:             bid.FinalBidValue,
		L1Price:                   bid.L1Price,
		QuotedPrice:               bid.QuotedPrice,
		StartDate:                 bid.StartDate,
		EndDate:                   bid.EndDate,
		OpeningDate:               bid.OpeningDate,
		ClosingDate:               bid.ClosingDate,
		DurationMonths:            bid.DurationMonths,
		Authority:                 bid.Authority,
		HighLevelScope:            bid.HighLevelScope,
		BGRequired:                bid.BGRequired,
		BGRate:                    bid.BGRate,
		Category:                  bid.Category,
		Quantity:                  bid.Quantity,
		OurRank:                   bid.OurRank,
		BidType:                   bid.BidType,
		GemBidType:                bid.GemBidType,
		QualificationStatus:       bid.QualificationStatus,
		BidOutcome:                bid.BidOutcome,
		OutcomeReason:             bid.OutcomeReason,
		TechComplianceStatus:      bid.TechComplianceStatus,
		Remarks:                   bid.Remarks,
		CompetitorInfo:            competitorInfo,
		Metadata:                  metadata,
		BidOwner:                  *owner,
		ReportingManager:          reportingManager,
		Members:                   members,
		Checklists:                checklists,
		CreatedBy:                 bid.CreatedBy,
		AISourceDocumentID:        bid.AISourceDocumentID,
		AIExtractionConfidence:    bid.AIExtractionConfidence,
		Team:                      bid.Team,
		ScopeType:                 bid.ScopeType,
		ActivityType:              bid.ActivityType,
		ExcelBidStatus:            bid.ExcelBidStatus,
		SubmissionStatus:          bid.SubmissionStatus,
		FinancialEvaluationStatus: bid.FinancialEvaluationStatus,
		POReceivedStatus:          bid.POReceivedStatus,
		BidResult:                 bid.BidResult,
		FinanceAlerted:            bid.FinanceAlerted,
		EMDReady:                  bid.EMDReady,
		EMDReadyDate:              bid.EMDReadyDate,
		EMDReturned:               bid.EMDReturned,
		EMDReturnedDate:           bid.EMDReturnedDate,
		BGDischarged:              bid.BGDischarged,
		BGDischargedDate:          bid.BGDischargedDate,
		BGTargetDate:              bid.BGTargetDate,
		POReceivedDate:            bid.POReceivedDate,
		DeliveryComplete:          bid.DeliveryComplete,
		DeliveryCompleteDate:      bid.DeliveryCompleteDate,
		SubmissionDone:            bid.SubmissionDone,
		GemSubmissionPrice:        bid.GemSubmissionPrice,
		FinalPrice:                bid.FinalPrice,
		TechnicalResult:           bid.TechnicalResult,
		DisqualificationReason:    bid.DisqualificationReason,
		FinancialResult:           bid.FinancialResult,
		L1CompanyName:             bid.L1CompanyName,
		PriceDifference:           bid.PriceDifference,
		PriceDifferencePct:        bid.PriceDifferencePct,
		EligibilityRemarks:        bid.EligibilityRemarks,
		EMDRemarks:                bid.EMDRemarks,
		TargetMonthDate:           bid.TargetMonthDate,
		IsImported:                isImportedBid(bid.Metadata),
		StageCompletions:          completions,
		StageRemarks:              remarks,
		StageReviews:              reviews,
		PricingWorkspace:          pricingWorkspace,
		OEMWorkspace:              oemWorkspace,
		EMDBankName:               bid.EMDBankName,
		EMDAccountNumber:          bid.EMDAccountNumber,
		EMDIFSCCode:               bid.EMDIFSCCode,
		EMDBranch:                 bid.EMDBranch,
		EMDBeneficiary:            bid.EMDBeneficiary,
		EMDPayableAt:              bid.EMDPayableAt,
		CreatedAt:                 bid.CreatedAt,
		UpdatedAt:                 bid.UpdatedAt,
		ArchivedAt:                bid.ArchivedAt,
		ResultDate:                bid.ResultDate,
		DaysRemaining:             calcDaysRemaining(bid.ArchivedAt),
	}
}

// isImportedBid reports whether a bid was created by the bulk importer, which
// stamps {"imported": true} into metadata. Surfaced so the UI can badge these
// rows - they carry a derived stage rather than one the team walked through.
func isImportedBid(metadata []byte) bool {
	if len(metadata) == 0 {
		return false
	}
	var m struct {
		Imported bool `json:"imported"`
	}
	if err := json.Unmarshal(metadata, &m); err != nil {
		return false
	}
	return m.Imported
}

func calcDaysRemaining(archivedAt *time.Time) *int {
	if archivedAt == nil {
		return nil
	}
	daysPassed := int(time.Since(*archivedAt).Hours() / 24)
	rem := 15 - daysPassed
	if rem < 0 {
		rem = 0
	}
	return &rem
}

func buildBidListItem(bid *domain.BidWorkspace, owner *domain.UserSummary) domain.BidListItem {
	return domain.BidListItem{
		ID:                        bid.ID,
		BidNo:                     bid.BidNo,
		GemBidNo:                  bid.GemBidNo,
		Title:                     bid.Title,
		OrganizationName:          bid.OrganizationName,
		DepartmentName:            bid.DepartmentName,
		PortalSource:              bid.PortalSource,
		Category:                  bid.Category,
		Quantity:                  bid.Quantity,
		OurRank:                   bid.OurRank,
		BidType:                   bid.BidType,
		CreationMode:              bid.CreationMode,
		WorkflowStage:             bid.WorkflowStage,
		BidStatus:                 bid.BidStatus,
		BidOutcome:                bid.BidOutcome,
		EstimatedValue:            bid.EstimatedValue,
		EMDAmount:                 bid.EMDAmount,
		EMDType:                   bid.EMDType,
		OpeningDate:               bid.OpeningDate,
		ClosingDate:               bid.ClosingDate,
		StartDate:                 bid.StartDate,
		EndDate:                   bid.EndDate,
		HighLevelScope:            bid.HighLevelScope,
		OEMRequired:               bid.OEMRequired,
		BidOwner:                  *owner,
		Remarks:                   bid.Remarks,
		Team:                      bid.Team,
		ScopeType:                 bid.ScopeType,
		BGRate:                    bid.BGRate,
		ActivityType:              bid.ActivityType,
		TargetMonthDate:           bid.TargetMonthDate,
		IsImported:                isImportedBid(bid.Metadata),
		ExcelBidStatus:            bid.ExcelBidStatus,
		SubmissionStatus:          bid.SubmissionStatus,
		FinancialEvaluationStatus: bid.FinancialEvaluationStatus,
		POReceivedStatus:          bid.POReceivedStatus,
		POReceivedDate:            bid.POReceivedDate,
		EMDExempted:               bid.EMDExempted,
		EMDNotApplicable:          bid.EMDNotApplicable,
		EMDExemptionType:          bid.EMDExemptionType,
		EMDExemptionReason:        bid.EMDExemptionReason,
		SubmissionDone:            bid.SubmissionDone,
		EMDReady:                  bid.EMDReady,
		EMDReadyDate:              bid.EMDReadyDate,
		EMDReturned:               bid.EMDReturned,
		BGDischargedDate:          bid.BGDischargedDate,
		DeliveryComplete:          bid.DeliveryComplete,
		DeliveryCompleteDate:      bid.DeliveryCompleteDate,
		QuotedPrice:               bid.QuotedPrice,
		FinalBidValue:             bid.FinalBidValue,
		TechnicalResult:           bid.TechnicalResult,
		FinancialResult:           bid.FinancialResult,
		HasTechEval:               bid.HasTechEval,
		BidResult:                 bid.BidResult,
		CreatedAt:                 bid.CreatedAt,
		ArchivedAt:                bid.ArchivedAt,
		DaysRemaining:             calcDaysRemaining(bid.ArchivedAt),
	}
}
