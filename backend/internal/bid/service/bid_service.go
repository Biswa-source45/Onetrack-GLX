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
	case domain.StagePrimaryReview:
		return "ACCOUNT_MANAGER"
	case domain.StageDiscovered, domain.StageOEMAuthorizationRequest, domain.StagePricingRequest:
		return "PRE_SALES"
	case domain.StageDocumentChecklistPrep, domain.StageTechnicalEvaluation, domain.StageGeMSubmission:
		return "TECHNICAL"
	case domain.StageEMDProcessing, domain.StageFinancialEvaluation:
		return "FINANCE"
	case domain.StageInternalApproval, domain.StageAwardHandover:
		return "MANAGEMENT"
	default:
		return "ALL"
	}
}

// hasAnyRole reports whether actorRoles contains any of the given roles.
func hasAnyRole(actorRoles []string, roles ...string) bool {
	for _, r := range actorRoles {
		for _, want := range roles {
			if r == want {
				return true
			}
		}
	}
	return false
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

// str returns a pointer's trimmed value, or "" for nil — shared by every
// alert-email summary builder below so an absent field never renders "<nil>".
func str(p *string) string {
	if p == nil {
		return ""
	}
	return strings.TrimSpace(*p)
}

// money formats a nullable currency amount, or "" for nil.
func money(v *float64) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("Rs. %.2f", *v)
}

// rowsToHTMLTable renders label/value pairs as the same two-column table used
// by every tender-detail alert email, skipping rows with no value.
func rowsToHTMLTable(rows [][2]string) string {
	var b strings.Builder
	b.WriteString(`<table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:8px;">`)
	for _, r := range rows {
		if strings.TrimSpace(r[1]) == "" {
			continue
		}
		fmt.Fprintf(&b, `<tr><td style="padding:4px 14px 4px 0;color:#64748b;font-weight:600;white-space:nowrap;vertical-align:top;">%s</td><td style="padding:4px 0;color:#0f172a;">%s</td></tr>`, r[0], r[1])
	}
	b.WriteString(`</table>`)
	return b.String()
}

// alertNoteColors mirrors the frontend's ALERT_NOTE_COLORS palette
// (AddTenderPage.jsx) — key -> [background, border, text, solid] — so a
// note's chosen color renders identically in the mailed alert as it does in
// the app. Deliberately more varied than a single fixed accent, since the
// whole point of the picker is that different challenges read as visually
// distinct at a glance.
var alertNoteColors = map[string][4]string{
	"amber":   {"#fffbeb", "#fde68a", "#92400e", "#f59e0b"},
	"rose":    {"#fff1f2", "#fecdd3", "#9f1239", "#f43f5e"},
	"violet":  {"#f5f3ff", "#ddd6fe", "#5b21b6", "#8b5cf6"},
	"cyan":    {"#ecfeff", "#a5f3fc", "#155e75", "#06b6d4"},
	"emerald": {"#ecfdf5", "#a7f3d0", "#065f46", "#10b981"},
	"fuchsia": {"#fdf4ff", "#f5d0fe", "#86198f", "#d946ef"},
	"orange":  {"#fff7ed", "#fed7aa", "#9a3412", "#fb923c"},
	"indigo":  {"#eef2ff", "#c7d2fe", "#3730a3", "#6366f1"},
}

type alertNoteFields struct {
	Text  string `json:"text"`
	Label string `json:"label"`
	Color string `json:"color"`
}

// alertNoteHTML renders the Add Tender "Additional Info / Challenge" note
// (if one was set) as a colored callout below the detail table, so a
// flagged challenge is visible at a glance in the identification email
// rather than buried as one more plain row.
func alertNoteHTML(raw *string) string {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return ""
	}
	var n alertNoteFields
	if err := json.Unmarshal([]byte(*raw), &n); err != nil || strings.TrimSpace(n.Text) == "" {
		return ""
	}
	c, ok := alertNoteColors[n.Color]
	if !ok {
		c = alertNoteColors["amber"]
	}
	label := strings.TrimSpace(n.Label)
	if label == "" {
		label = "Attention"
	}
	return fmt.Sprintf(
		`<div style="margin:12px 0 0 0;padding:10px 14px;border-radius:8px;background:%s;border:1px solid %s;border-left:4px solid %s;color:%s;font-size:12px;"><span style="display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;background:%s;color:#fff;padding:2px 8px;border-radius:999px;">%s</span><div style="margin-top:6px;">%s</div></div>`,
		c[0], c[1], c[3], c[2], c[3], label, n.Text,
	)
}

// tenderSummaryHTML renders a tender's key facts as an HTML table so the
// tender-identification alert emails (Reporting Manager / Account Manager /
// Pre-Sales, sent on creation) carry full detail dynamically, rather than the
// one-line mention a recipient previously had to open the app to expand on.
func tenderSummaryHTML(req *domain.CreateBidRequest, gemBidNoStr string) string {
	bg := "Not Required"
	if req.BGRequired != nil && *req.BGRequired {
		bg = "Required"
		if req.BGRate != nil {
			bg += fmt.Sprintf(" — %.2f%%", *req.BGRate)
		}
		if req.BGDurationMonths != nil {
			bg += fmt.Sprintf(", %d month(s)", *req.BGDurationMonths)
		}
	}
	emd := "Not Applicable"
	if req.EMDNotApplicable == nil || !*req.EMDNotApplicable {
		emd = money(req.EMDAmount)
	}
	online := "No"
	if str(req.EMDBankName) != "" {
		online = "Yes — " + str(req.EMDBankName)
	}
	dd := "No"
	if str(req.EMDBeneficiary) != "" {
		dd = "Yes — " + str(req.EMDBeneficiary)
	}

	rows := [][2]string{
		{"Tender Title", req.Title},
		{"GeM / RFP No.", gemBidNoStr},
		{"Account Name", str(req.OrganizationName)},
		{"Department / Ministry", str(req.DepartmentName)},
		{"Location", str(req.Location)},
		{"Category", str(req.Category)},
		{"High-Level Scope", str(req.HighLevelScope)},
		{"Estimated Value", money(req.EstimatedValue)},
		{"EMD Amount", emd},
		{"EMD Online Available", online},
		{"EMD DD Available", dd},
		{"Exemptions Listed", strings.Join(req.EMDExemptionTypes, ", ")},
		{"Bank Guarantee", bg},
	}

	return rowsToHTMLTable(rows) + alertNoteHTML(req.AlertNote)
}

// ownershipChangeSummaryHTML renders the same tender-detail table as
// tenderSummaryHTML, but from the persisted BidWorkspace — used for the
// "you're the new Bid Owner" alert email fired on a later reassignment,
// where only the workspace row (not the original CreateBidRequest) is
// available. title is passed separately since it may be changing in the
// same request that reassigns the owner.
func ownershipChangeSummaryHTML(bid *domain.BidWorkspace, title string) string {
	gemBidNoStr := str(bid.GemBidNo)
	if gemBidNoStr == "" {
		gemBidNoStr = str(bid.BidNo)
	}
	rows := [][2]string{
		{"Tender Title", title},
		{"GeM / RFP No.", gemBidNoStr},
		{"Account Name", str(bid.OrganizationName)},
		{"Department / Ministry", str(bid.DepartmentName)},
		{"Location", str(bid.Location)},
		{"Category", str(bid.Category)},
		{"High-Level Scope", str(bid.HighLevelScope)},
		{"Estimated Value", money(bid.EstimatedValue)},
	}
	return rowsToHTMLTable(rows)
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
		AccountManagerID:   req.AccountManagerID,
		PresalesID:         req.PresalesID,
		Location:           req.Location,
		BGDurationMonths:   req.BGDurationMonths,
		CreatedBy:          createdBy,
		EstimatedValue:     req.EstimatedValue,
		EMDAmount:          req.EMDAmount,
		EMDType:            req.EMDType,
		EMDExemptionTypes:  req.EMDExemptionTypes,
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
	if req.RequestedProducts != nil {
		params.RequestedProducts = []byte(*req.RequestedProducts)
	}
	if req.AlertNote != nil {
		params.AlertNote = []byte(*req.AlertNote)
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

	// Auto-add the Account Manager (required — the tender's approving authority)
	// and Pre-Sales (optional) as members so they show up in the team panel.
	_ = s.repo.AddMember(ctx, id, req.AccountManagerID, "ACCOUNT_MANAGER", createdBy)
	if req.PresalesID != nil {
		_ = s.repo.AddMember(ctx, id, *req.PresalesID, "PRESALES", createdBy)
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

		// No broadcast-to-every-Pre-Sales-user alert here — only the Account
		// Manager and (if chosen) the specific Pre-Sales person assigned to
		// this tender are notified below, plus the Reporting Manager.
		detailTable := tenderSummaryHTML(req, gemBidNoStr)

		// Directly notify the Reporting Manager (in-app alert + email, via the
		// same CreateAlert -> dispatchAlertEmails path) that they've been
		// assigned to a newly discovered tender.
		if req.ReportingManagerID != nil {
			_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
				UserID:    req.ReportingManagerID,
				BidID:     &bidIdCopy,
				CreatedBy: &createdBy,
				Type:      "TENDER_ASSIGNED_REPORTING_MANAGER",
				Title:     fmt.Sprintf("New Tender Discovered: %s", req.Title),
				Message:   fmt.Sprintf("<p>You've been assigned as Reporting Manager for tender '%s'. Please review.</p>%s", req.Title, detailTable),
			})
		}

		// Directly notify the Account Manager — they're the approving authority
		// for this tender and own the Primary Review Go/No-Go decision next.
		_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			UserID:    &req.AccountManagerID,
			BidID:     &bidIdCopy,
			CreatedBy: &createdBy,
			Type:      "TENDER_ASSIGNED_ACCOUNT_MANAGER",
			Title:     fmt.Sprintf("You're the Account Manager: %s", req.Title),
			Message:   fmt.Sprintf("<p>Tender '%s' has been created and assigned to you as Account Manager. Please complete Primary Review (Go/No-Go).</p>%s", req.Title, detailTable),
		})

		if req.PresalesID != nil {
			_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
				UserID:    req.PresalesID,
				BidID:     &bidIdCopy,
				CreatedBy: &createdBy,
				Type:      "TENDER_ASSIGNED_PRESALES",
				Title:     fmt.Sprintf("New Tender for Pre-Sales: %s", req.Title),
				Message:   fmt.Sprintf("<p>You've been assigned as Pre-Sales for tender '%s'.</p>%s", req.Title, detailTable),
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

	var accountManager *domain.UserSummary
	if bid.AccountManagerID != nil {
		am, err := s.repo.GetUserSummary(ctx, *bid.AccountManagerID)
		if err == nil {
			accountManager = am
		}
	}

	var presales *domain.UserSummary
	if bid.PresalesID != nil {
		ps, err := s.repo.GetUserSummary(ctx, *bid.PresalesID)
		if err == nil {
			presales = ps
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

	return buildBidResponse(bid, owner, reportingManager, accountManager, presales, members, checklistItems), nil
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
		var accountManager *domain.UserSummary
		if b.AccountManagerID != nil {
			accountManager, _ = s.repo.GetUserSummary(ctx, *b.AccountManagerID)
		}
		var presales *domain.UserSummary
		if b.PresalesID != nil {
			presales, _ = s.repo.GetUserSummary(ctx, *b.PresalesID)
		}
		items = append(items, buildBidListItem(&b, owner, accountManager, presales))
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

func (s *bidService) UpdateBid(ctx context.Context, id string, req *domain.UpdateBidRequest, actorID string, actorRoles []string) error {
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

	// Bid Owner reassignment is restricted to this tender's own Account
	// Manager / Reporting Manager (or an admin) — not every bid.edit holder,
	// and not the outgoing owner themself. A no-op resubmission of the same
	// owner id is not a reassignment and skips both checks below.
	ownerChangeRequested := req.BidOwnerID != nil && strings.TrimSpace(*req.BidOwnerID) != "" && *req.BidOwnerID != bid.BidOwnerID
	if ownerChangeRequested {
		isAdmin := hasAnyRole(actorRoles, "SUPER_ADMIN", "ADMIN")
		isTenderAccountManager := bid.AccountManagerID != nil && *bid.AccountManagerID == actorID
		isTenderReportingManager := bid.ReportingManagerID != nil && *bid.ReportingManagerID == actorID
		if !isAdmin && !isTenderAccountManager && !isTenderReportingManager {
			return fmt.Errorf("%w: only this tender's Account Manager or Reporting Manager can reassign the Bid Owner", domain.ErrForbidden)
		}

		// The Account Manager is the tender's approving authority (owns the
		// Primary Review Go/No-Go and pricing sign-off) — letting them also be
		// the Bid Owner they're reviewing breaks that separation of duties.
		// Effective AM is the merged value: a reassignment landing in the same
		// request as the owner change must be checked against the new AM, not
		// the stale one.
		effectiveAccountManagerID := ""
		if bid.AccountManagerID != nil {
			effectiveAccountManagerID = *bid.AccountManagerID
		}
		if req.AccountManagerID != nil && strings.TrimSpace(*req.AccountManagerID) != "" {
			effectiveAccountManagerID = *req.AccountManagerID
		}
		if effectiveAccountManagerID != "" && effectiveAccountManagerID == *req.BidOwnerID {
			return fmt.Errorf("%w: cannot assign this tender's Account Manager as Bid Owner — choose a different owner", domain.ErrValidation)
		}
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

	// Track Account Manager / Pre-Sales reassignment so a real-name change fires
	// a fresh "you've been assigned" alert to the newly assigned person — the
	// same pattern as the create-time assignment, just for a later reassignment.
	newAccountManagerID := ""
	if req.AccountManagerID != nil && (bid.AccountManagerID == nil || *req.AccountManagerID != *bid.AccountManagerID) {
		newAccountManagerID = *req.AccountManagerID
		changes = append(changes, "Account Manager reassigned")
	}
	newPresalesID := ""
	if req.PresalesID != nil && *req.PresalesID != "" && (bid.PresalesID == nil || *req.PresalesID != *bid.PresalesID) {
		newPresalesID = *req.PresalesID
		changes = append(changes, "Pre-Sales assigned")
	}
	newReportingManagerID := ""
	if req.ReportingManagerID != nil && *req.ReportingManagerID != "" && (bid.ReportingManagerID == nil || *req.ReportingManagerID != *bid.ReportingManagerID) {
		newReportingManagerID = *req.ReportingManagerID
		changes = append(changes, "Reporting Manager reassigned")
	}
	// newOwnerID mirrors ownerChangeRequested computed above (already validated
	// for permission + the Account-Manager-can't-also-own-it rule).
	newOwnerID := ""
	if ownerChangeRequested {
		newOwnerID = *req.BidOwnerID
		changes = append(changes, fmt.Sprintf("Bid Owner: '%s' → '%s'", bid.BidOwnerID, newOwnerID))
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

	// Internal Approval readiness: once the last thing standing between this
	// tender and Internal Approval is actually done, notify the Account
	// Manager and Pre-Sales proactively rather than leaving it to be noticed
	// manually. That "last thing" is Document Checklist Preparation when EMD
	// isn't required, or EMD Processing itself when it is — exactly one of
	// the two per tender. Fires only on the actual completion transition
	// (not on every later resave of an already-complete tender), mirroring
	// the DISQUALIFIED->LOST automation above.
	notifyInternalApprovalReady := false
	var handoffRemarks string
	{
		var existingCompletions map[string]bool
		if len(bid.StageCompletions) > 0 {
			_ = json.Unmarshal(bid.StageCompletions, &existingCompletions)
		}
		emdNotRequired := mergedEMDExempted || mergedEMDNotApplicable
		checklistJustCompleted := req.StageCompletions != nil && req.StageCompletions[domain.StageDocumentChecklistPrep] &&
			!existingCompletions[domain.StageDocumentChecklistPrep]
		emdJustCompleted := req.StageCompletions != nil && req.StageCompletions[domain.StageEMDProcessing] &&
			!existingCompletions[domain.StageEMDProcessing]
		triggered := (emdNotRequired && checklistJustCompleted) || (!emdNotRequired && emdJustCompleted)
		if triggered && (bid.AccountManagerID != nil || bid.PresalesID != nil) {
			notifyInternalApprovalReady = true
			if req.StageRemarks != nil {
				if emdNotRequired {
					handoffRemarks = req.StageRemarks[domain.StageDocumentChecklistPrep]
				} else {
					handoffRemarks = req.StageRemarks[domain.StageEMDProcessing]
				}
			}
		}
	}

	if err := s.repo.Update(ctx, id, req); err != nil {
		return err
	}

	// A reassignment via update needs the same team-panel membership
	// CreateBid gives each structured role at creation time — otherwise a
	// person assigned later (e.g. a new Bid Owner, or Primary Review's
	// "Assign Pre-Sales") never shows up in the tender's Members tab, and the
	// person they replaced lingers there forever. addMemberAndDropPrevious
	// keeps the team panel in lockstep with the actual FK assignment instead
	// of only ever growing.
	addMemberAndDropPrevious := func(role, previousID, nextID string) {
		if nextID == "" || nextID == previousID {
			return
		}
		_ = s.repo.AddMember(ctx, id, nextID, role, actorID)
		if previousID != "" {
			_ = s.repo.RemoveMember(ctx, id, previousID)
		}
	}
	previousAccountManagerID := ""
	if bid.AccountManagerID != nil {
		previousAccountManagerID = *bid.AccountManagerID
	}
	previousPresalesID := ""
	if bid.PresalesID != nil {
		previousPresalesID = *bid.PresalesID
	}
	previousReportingManagerID := ""
	if bid.ReportingManagerID != nil {
		previousReportingManagerID = *bid.ReportingManagerID
	}
	addMemberAndDropPrevious("OWNER", bid.BidOwnerID, newOwnerID)
	addMemberAndDropPrevious("ACCOUNT_MANAGER", previousAccountManagerID, newAccountManagerID)
	addMemberAndDropPrevious("PRESALES", previousPresalesID, newPresalesID)
	addMemberAndDropPrevious("MANAGER", previousReportingManagerID, newReportingManagerID)

	if s.alertSvc != nil {
		bidIdCopy := id
		if newOwnerID != "" {
			_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
				UserID: &newOwnerID, BidID: &bidIdCopy, CreatedBy: &actorID,
				Type:  "TENDER_OWNERSHIP_CHANGED",
				Title: fmt.Sprintf("Tender Ownership Changed: %s", bid.Title),
				Message: fmt.Sprintf(
					"<p>You have been assigned as the new Bid Owner for tender '%s'. Please review the details below.</p>%s",
					bid.Title, ownershipChangeSummaryHTML(bid, bid.Title),
				),
			})
		}
		if newAccountManagerID != "" {
			_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
				UserID: &newAccountManagerID, BidID: &bidIdCopy, CreatedBy: &actorID,
				Type:    "TENDER_ASSIGNED_ACCOUNT_MANAGER",
				Title:   fmt.Sprintf("You're the Account Manager: %s", bid.Title),
				Message: fmt.Sprintf("You've been assigned as Account Manager for tender '%s'. Please complete Primary Review (Go/No-Go).", bid.Title),
			})
		}
		if newPresalesID != "" {
			_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
				UserID: &newPresalesID, BidID: &bidIdCopy, CreatedBy: &actorID,
				Type:    "TENDER_ASSIGNED_PRESALES",
				Title:   fmt.Sprintf("New Tender for Pre-Sales: %s", bid.Title),
				Message: fmt.Sprintf("You've been assigned as Pre-Sales for tender '%s'.", bid.Title),
			})
		}
		if newReportingManagerID != "" {
			_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
				UserID: &newReportingManagerID, BidID: &bidIdCopy, CreatedBy: &actorID,
				Type:    "TENDER_ASSIGNED_REPORTING_MANAGER",
				Title:   fmt.Sprintf("You're the Reporting Manager: %s", bid.Title),
				Message: fmt.Sprintf("You've been assigned as Reporting Manager for tender '%s'. Please review.", bid.Title),
			})
		}
		if notifyInternalApprovalReady {
			remarksHTML := ""
			if strings.TrimSpace(handoffRemarks) != "" {
				remarksHTML = fmt.Sprintf(`<p style="margin:12px 0 0 0;padding:10px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:13px;">%s</p>`, handoffRemarks)
			}
			message := fmt.Sprintf("<p>Tender '%s' is ready for Internal Approval sign-off.</p>%s", bid.Title, remarksHTML)
			recipients := map[string]bool{}
			if bid.AccountManagerID != nil {
				recipients[*bid.AccountManagerID] = true
			}
			if bid.PresalesID != nil {
				recipients[*bid.PresalesID] = true
			}
			for uid := range recipients {
				uidCopy := uid
				_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
					UserID: &uidCopy, BidID: &bidIdCopy, CreatedBy: &actorID,
					Type:    "INTERNAL_APPROVAL_READY",
					Title:   fmt.Sprintf("Ready for Internal Approval: %s", bid.Title),
					Message: message,
				})
			}
		}
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

func (s *bidService) RemoveMember(ctx context.Context, bidID string, userID string, actorID string) error {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return err
	}

	// The Bid Owner and Account Manager are required on every tender (they
	// gate ownership reporting and the Primary Review Go/No-Go respectively)
	// — removing them here would desync the team panel from the FK column
	// that actually drives the app. Reassign a replacement via Edit Tender
	// instead, which keeps both in step (see UpdateBid's membership sync).
	if userID == bid.BidOwnerID {
		return fmt.Errorf("%w: cannot remove the Bid Owner — reassign a new owner via Edit Tender instead", domain.ErrValidation)
	}
	if bid.AccountManagerID != nil && userID == *bid.AccountManagerID {
		return fmt.Errorf("%w: cannot remove the Account Manager — reassign via Edit Tender instead", domain.ErrValidation)
	}

	if err := s.repo.RemoveMember(ctx, bidID, userID); err != nil {
		return err
	}

	// Reporting Manager / Pre-Sales are optional relationships — clear the
	// matching FK when their member row is removed, so the removal actually
	// takes effect instead of leaving the tender still assigned to someone no
	// longer listed as a member.
	cleared := ""
	update := &domain.UpdateBidRequest{}
	changed := false
	if bid.ReportingManagerID != nil && userID == *bid.ReportingManagerID {
		update.ReportingManagerID = &cleared
		changed = true
	}
	if bid.PresalesID != nil && userID == *bid.PresalesID {
		update.PresalesID = &cleared
		changed = true
	}
	if changed {
		_ = s.repo.Update(ctx, bidID, update)
	}
	return nil
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

func buildBidResponse(bid *domain.BidWorkspace, owner *domain.UserSummary, reportingManager *domain.UserSummary, accountManager *domain.UserSummary, presales *domain.UserSummary, members []domain.MemberResponse, checklists []domain.BidChecklistItem) *domain.BidResponse {
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

	var requestedProducts interface{}
	if len(bid.RequestedProducts) > 0 {
		_ = json.Unmarshal(bid.RequestedProducts, &requestedProducts)
	}

	var primaryReview interface{}
	if len(bid.PrimaryReview) > 0 {
		_ = json.Unmarshal(bid.PrimaryReview, &primaryReview)
	}

	var alertNote interface{}
	if len(bid.AlertNote) > 0 {
		_ = json.Unmarshal(bid.AlertNote, &alertNote)
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
		EMDExemptionTypes:         bid.EMDExemptionTypes,
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
		AccountManager:            accountManager,
		Presales:                  presales,
		Location:                  bid.Location,
		BGDurationMonths:          bid.BGDurationMonths,
		RequestedProducts:         requestedProducts,
		PrimaryReview:             primaryReview,
		AlertNote:                 alertNote,
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

func buildBidListItem(bid *domain.BidWorkspace, owner *domain.UserSummary, accountManager *domain.UserSummary, presales *domain.UserSummary) domain.BidListItem {
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
		AccountManager:            accountManager,
		Presales:                  presales,
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
