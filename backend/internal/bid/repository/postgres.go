package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/bid/domain"
)

type postgresBidRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresBidRepository(pool *pgxpool.Pool) domain.BidRepository {
	return &postgresBidRepo{pool: pool}
}

func (r *postgresBidRepo) Create(ctx context.Context, params *domain.CreateBidParams) (string, error) {
	startDate := params.StartDate
	endDate := params.EndDate

	query := `
		INSERT INTO bid.bid_workspaces (
			bid_no, gem_bid_no, title, organization_name, department_name,
			portal_source, creation_mode, workflow_stage, bid_status,
			bid_owner_id, reporting_manager_id, created_by,
			estimated_value, emd_amount, emd_type, emd_exempted,
			emd_exemption_type, emd_exemption_reason,
			emd_bank_name, emd_account_number, emd_ifsc_code, emd_branch,
			emd_beneficiary, emd_payable_at,
			bg_required, bg_rate, high_level_scope,
			start_date, end_date, opening_date, closing_date, duration_months, authority,
			category, bid_type, gem_bid_type,
			remarks, metadata,
			team, scope_type, activity_type,
			excel_bid_status, submission_status, financial_evaluation_status, po_received_status,
			bid_result, ai_source_document_id, ai_extraction_confidence, stage_completions
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12,
			$13, $14, $15, $16,
			$17, $18,
			$19, $20, $21, $22,
			$23, $24,
			$25, $26, $27,
			$28, $29, $30, $31, $32, $33,
			$34, $35, $36,
			$37, $38,
			$39, $40, $41,
			$42, $43, $44, $45, $46, $47, $48, '{"DISCOVERED": true}'::jsonb
		) RETURNING id
	`
	var id string
	err := r.pool.QueryRow(ctx, query,
		params.BidNo, params.GemBidNo, params.Title, params.OrganizationName, params.DepartmentName,
		params.PortalSource, params.CreationMode, domain.StageDiscovered, domain.BidStatusActive,
		params.BidOwnerID, params.ReportingManagerID, params.CreatedBy,
		params.EstimatedValue, params.EMDAmount, params.EMDType, params.EMDExempted,
		params.EMDExemptionType, params.EMDExemptionReason,
		params.EMDBankName, params.EMDAccountNumber, params.EMDIFSCCode, params.EMDBranch,
		params.EMDBeneficiary, params.EMDPayableAt,
		params.BGRequired, params.BGRate, params.HighLevelScope,
		startDate, endDate, startDate, endDate, params.DurationMonths, params.Authority,
		params.Category, params.BidType, params.GemBidType,
		params.Remarks, params.Metadata,
		params.Team, params.ScopeType, params.ActivityType,
		params.ExcelBidStatus, params.SubmissionStatus, params.FinancialEvaluationStatus, params.POReceivedStatus,
		params.BidResult, params.AISourceDocumentID, params.AIExtractionConfidence,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("failed to create bid: %w", err)
	}
	return id, nil
}

func (r *postgresBidRepo) GetByID(ctx context.Context, id string) (*domain.BidWorkspace, error) {
	query := `
		SELECT id, bid_no, gem_bid_no, title, organization_name, department_name,
		       portal_source, creation_mode, workflow_stage, bid_status,
		       bid_owner_id, reporting_manager_id, created_by,
		       estimated_value, emd_amount, emd_type, emd_exempted,
		       emd_exemption_type, emd_exemption_reason,
		       final_bid_value, l1_price, quoted_price,
		       start_date, end_date, opening_date, closing_date, duration_months, authority,
		       high_level_scope, bg_required, bg_rate,
		       category, bid_type, gem_bid_type,
		       qualification_status, bid_outcome, outcome_reason, tech_compliance_status,
		       remarks, competitor_info, metadata,
		       ai_source_document_id, ai_extraction_confidence,
		       created_at, updated_at, archived_at,
		       team, scope_type, activity_type,
		       excel_bid_status, submission_status, financial_evaluation_status, po_received_status,
		       bid_result,
		       finance_alerted, emd_ready, emd_returned, bg_discharged, submission_done,
		       gem_submission_price, final_price,
		       technical_result, disqualification_reason, financial_result,
		       l1_company_name, price_difference, price_difference_pct,
		       eligibility_remarks, emd_remarks,
		       COALESCE(stage_completions, '{}'::jsonb), COALESCE(stage_remarks, '{}'::jsonb), COALESCE(stage_reviews, '{}'::jsonb),
		       pricing_workspace, oem_workspace,
		       emd_bank_name, emd_account_number, emd_ifsc_code, emd_branch,
		       emd_beneficiary, emd_payable_at,
		       po_received_date, bg_target_date, bg_discharged_date, emd_returned_date,
		       emd_ready_date, delivery_complete, delivery_complete_date
		FROM bid.bid_workspaces
		WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)
	return scanBid(row)
}

func (r *postgresBidRepo) List(ctx context.Context, params domain.ListBidsParams) ([]domain.BidWorkspace, int, map[string]int, error) {
	conditions := []string{}
	if params.InBin {
		_ = r.CleanupExpired(ctx)
		conditions = append(conditions, "b.archived_at IS NOT NULL")
	} else {
		conditions = append(conditions, "b.archived_at IS NULL")
	}
	args := []interface{}{}
	idx := 1

	if params.Search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(b.title ILIKE $%d OR b.bid_no ILIKE $%d OR b.gem_bid_no ILIKE $%d OR b.organization_name ILIKE $%d OR b.department_name ILIKE $%d OR b.category ILIKE $%d OR u.full_name ILIKE $%d)",
			idx, idx+1, idx+2, idx+3, idx+4, idx+5, idx+6,
		))
		search := "%" + params.Search + "%"
		args = append(args, search, search, search, search, search, search, search)
		idx += 7
	}
	if params.WorkflowStage != "" {
		conditions = append(conditions, fmt.Sprintf("b.workflow_stage = $%d", idx))
		args = append(args, params.WorkflowStage)
		idx++
	}
	if params.BidStatus != "" {
		switch params.BidStatus {
		case "WON":
			conditions = append(conditions, "(b.bid_status = 'WON' OR b.workflow_stage = 'WON' OR b.bid_outcome = 'WON')")
		case "LOST":
			conditions = append(conditions, "(b.bid_status = 'LOST' OR b.workflow_stage = 'LOST' OR b.bid_outcome = 'LOST' OR b.technical_result = 'DISQUALIFIED')")
		case "CANCELLED":
			conditions = append(conditions, "(b.bid_status = 'CANCELLED' OR b.workflow_stage = 'CANCELLED' OR b.bid_outcome = 'CANCELLED')")
		case "SUBMITTED":
			conditions = append(conditions, "(b.bid_status = 'SUBMITTED' OR b.workflow_stage IN ('GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION') OR b.submission_status = 'SUBMITTED' OR b.submission_done = true)")
		case "TECHNICAL_EVALUATION":
			conditions = append(conditions, "(b.bid_status = 'TECHNICAL_EVALUATION' OR b.workflow_stage IN ('GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION') OR b.submission_status = 'SUBMITTED' OR b.submission_done = true)")
		case "ACTIVE":
			conditions = append(conditions, "(COALESCE(b.bid_status, 'ACTIVE') = 'ACTIVE' AND b.workflow_stage NOT IN ('WON', 'LOST', 'CANCELLED', 'GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION') AND COALESCE(b.bid_outcome, '') NOT IN ('WON', 'LOST', 'CANCELLED') AND COALESCE(b.technical_result, '') != 'DISQUALIFIED')")
		default:
			conditions = append(conditions, fmt.Sprintf("b.bid_status = $%d", idx))
			args = append(args, params.BidStatus)
			idx++
		}
	}
	if params.BidOutcome != "" {
		conditions = append(conditions, fmt.Sprintf("b.bid_outcome = $%d", idx))
		args = append(args, params.BidOutcome)
		idx++
	}
	if params.BidOwnerID != "" {
		conditions = append(conditions, fmt.Sprintf("(b.bid_owner_id = $%d OR b.created_by = $%d)", idx, idx+1))
		args = append(args, params.BidOwnerID, params.BidOwnerID)
		idx += 2
	}
	if params.Category != "" {
		conditions = append(conditions, fmt.Sprintf("b.category ILIKE $%d", idx))
		args = append(args, "%"+params.Category+"%")
		idx++
	}
	if params.CreationMode != "" {
		conditions = append(conditions, fmt.Sprintf("b.creation_mode = $%d", idx))
		args = append(args, params.CreationMode)
		idx++
	}
	if params.ClosingBefore != nil {
		conditions = append(conditions, fmt.Sprintf("b.closing_date <= $%d", idx))
		args = append(args, params.ClosingBefore)
		idx++
	}
	if params.ClosingAfter != nil {
		conditions = append(conditions, fmt.Sprintf("b.closing_date >= $%d", idx))
		args = append(args, params.ClosingAfter)
		idx++
	}
	if params.OEMRequired != nil {
		conditions = append(conditions, fmt.Sprintf("b.oem_required = $%d", idx))
		args = append(args, *params.OEMRequired)
		idx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	// Count total matching items for pagination
	var total int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM bid.bid_workspaces b
		LEFT JOIN auth.users u ON b.bid_owner_id = u.id
		%s
	`, where)
	err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, nil, fmt.Errorf("count bids: %w", err)
	}

	// Calculate global status counts (unfiltered by tab selection, so top summary cards remain persistent)
	baseConditions := []string{}
	baseArgs := []interface{}{}
	baseIdx := 1
	if params.InBin {
		baseConditions = append(baseConditions, "b.archived_at IS NOT NULL")
	} else {
		baseConditions = append(baseConditions, "b.archived_at IS NULL")
	}
	if params.BidOwnerID != "" {
		baseConditions = append(baseConditions, fmt.Sprintf("(b.bid_owner_id = $%d OR b.created_by = $%d)", baseIdx, baseIdx+1))
		baseArgs = append(baseArgs, params.BidOwnerID, params.BidOwnerID)
		baseIdx += 2
	}
	baseWhere := "WHERE " + strings.Join(baseConditions, " AND ")

	statusQuery := fmt.Sprintf(`
		SELECT 
			CASE 
				WHEN b.bid_status = 'WON' OR b.workflow_stage = 'WON' OR b.bid_outcome = 'WON' THEN 'WON'
				WHEN b.bid_status = 'LOST' OR b.workflow_stage = 'LOST' OR b.bid_outcome = 'LOST' OR b.technical_result = 'DISQUALIFIED' THEN 'LOST'
				WHEN b.bid_status = 'CANCELLED' OR b.workflow_stage = 'CANCELLED' OR b.bid_outcome = 'CANCELLED' THEN 'CANCELLED'
				WHEN b.bid_status = 'TECHNICAL_EVALUATION' OR b.workflow_stage IN ('GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION') OR b.submission_status = 'SUBMITTED' OR b.submission_done = true THEN 'TECHNICAL_EVALUATION'
				WHEN b.bid_status = 'SUBMITTED' THEN 'SUBMITTED'
				ELSE 'ACTIVE'
			END AS derived_status, 
			COUNT(*)
		FROM bid.bid_workspaces b
		%s
		GROUP BY 1
	`, baseWhere)

	rowsStatus, err := r.pool.Query(ctx, statusQuery, baseArgs...)
	if err != nil {
		return nil, 0, nil, fmt.Errorf("status counts: %w", err)
	}
	defer rowsStatus.Close()

	statusCounts := make(map[string]int)
	for rowsStatus.Next() {
		var status string
		var count int
		if err := rowsStatus.Scan(&status, &count); err == nil {
			statusCounts[status] = count
		}
	}

	offset := (params.Page - 1) * params.Limit
	listArgs := append(args, params.Limit, offset)
	dataQuery := fmt.Sprintf(`
		SELECT b.id, b.bid_no, b.gem_bid_no, b.title, b.organization_name, b.department_name,
		       b.portal_source, b.creation_mode, b.workflow_stage, b.bid_status,
		       b.bid_owner_id, b.reporting_manager_id, b.created_by,
		       b.estimated_value, b.emd_amount, b.emd_type, b.emd_exempted,
		       b.emd_exemption_type, b.emd_exemption_reason,
		       b.final_bid_value, b.l1_price, b.quoted_price,
		       b.start_date, b.end_date, b.opening_date, b.closing_date, b.duration_months, b.authority,
		       b.high_level_scope, b.bg_required, b.bg_rate,
		       b.category, b.bid_type, b.gem_bid_type,
		       b.qualification_status, b.bid_outcome, b.outcome_reason, b.tech_compliance_status,
		       b.remarks, b.competitor_info, b.metadata,
		       b.ai_source_document_id, b.ai_extraction_confidence,
		       b.created_at, b.updated_at, b.archived_at,
		       b.team, b.scope_type, b.activity_type,
		       b.excel_bid_status, b.submission_status, b.financial_evaluation_status, b.po_received_status,
		       b.bid_result,
		       b.finance_alerted, b.emd_ready, b.emd_returned, b.bg_discharged, b.submission_done,
		       b.gem_submission_price, b.final_price,
		       b.technical_result, b.disqualification_reason, b.financial_result,
		       b.l1_company_name, b.price_difference, b.price_difference_pct,
		       b.eligibility_remarks, b.emd_remarks,
		       COALESCE(b.stage_completions, '{}'::jsonb), COALESCE(b.stage_remarks, '{}'::jsonb), COALESCE(b.stage_reviews, '{}'::jsonb),
		       b.pricing_workspace, b.oem_workspace,
		       b.emd_bank_name, b.emd_account_number, b.emd_ifsc_code, b.emd_branch,
		       b.emd_beneficiary, b.emd_payable_at,
		       b.po_received_date, b.bg_target_date, b.bg_discharged_date, b.emd_returned_date,
		       b.emd_ready_date, b.delivery_complete, b.delivery_complete_date
		FROM bid.bid_workspaces b
		LEFT JOIN auth.users u ON b.bid_owner_id = u.id
		%s
		ORDER BY b.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, idx, idx+1)

	rows, err := r.pool.Query(ctx, dataQuery, listArgs...)
	if err != nil {
		return nil, 0, nil, fmt.Errorf("list bids: %w", err)
	}
	defer rows.Close()

	var bids []domain.BidWorkspace
	for rows.Next() {
		b, err := scanBidFromRows(rows)
		if err != nil {
			return nil, 0, nil, err
		}
		bids = append(bids, *b)
	}
	if bids == nil {
		bids = []domain.BidWorkspace{}
	}
	return bids, total, statusCounts, nil
}

func (r *postgresBidRepo) Update(ctx context.Context, id string, req *domain.UpdateBidRequest) error {
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	idx := 1

	addSet := func(col string, val interface{}) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, idx))
		args = append(args, val)
		idx++
	}

	if req.Title != nil {
		addSet("title", *req.Title)
	}
	if req.BidNo != nil {
		addSet("bid_no", *req.BidNo)
	}
	if req.GemBidNo != nil {
		addSet("gem_bid_no", *req.GemBidNo)
	}
	if req.OrganizationName != nil {
		addSet("organization_name", *req.OrganizationName)
	}
	if req.DepartmentName != nil {
		addSet("department_name", *req.DepartmentName)
	}
	if req.PortalSource != nil {
		addSet("portal_source", *req.PortalSource)
	}
	if req.BidType != nil {
		addSet("bid_type", *req.BidType)
	}
	if req.GemBidType != nil {
		addSet("gem_bid_type", *req.GemBidType)
	}
	if req.Category != nil {
		addSet("category", *req.Category)
	}
	if req.EstimatedValue != nil {
		addSet("estimated_value", *req.EstimatedValue)
	}
	if req.EMDAmount != nil {
		addSet("emd_amount", *req.EMDAmount)
	}
	if req.EMDType != nil {
		addSet("emd_type", *req.EMDType)
	}
	if req.EMDExempted != nil {
		addSet("emd_exempted", *req.EMDExempted)
	}
	// emd_exemption_type/reason are CHECK-constrained (NULL or MSME/STARTUP/OTHER),
	// so an empty-string sentinel (used by the service layer to clear them when
	// exemption is turned off) must be written as SQL NULL, not "".
	if req.EMDExemptionType != nil {
		if strings.TrimSpace(*req.EMDExemptionType) == "" {
			sets = append(sets, fmt.Sprintf("emd_exemption_type = $%d", idx))
			args = append(args, nil)
			idx++
		} else {
			addSet("emd_exemption_type", *req.EMDExemptionType)
		}
	}
	if req.EMDExemptionReason != nil {
		if strings.TrimSpace(*req.EMDExemptionReason) == "" {
			sets = append(sets, fmt.Sprintf("emd_exemption_reason = $%d", idx))
			args = append(args, nil)
			idx++
		} else {
			addSet("emd_exemption_reason", *req.EMDExemptionReason)
		}
	}
	// EMD bank / DD detail fields
	if req.EMDBankName != nil {
		addSet("emd_bank_name", *req.EMDBankName)
	}
	if req.EMDAccountNumber != nil {
		addSet("emd_account_number", *req.EMDAccountNumber)
	}
	if req.EMDIFSCCode != nil {
		addSet("emd_ifsc_code", *req.EMDIFSCCode)
	}
	if req.EMDBranch != nil {
		addSet("emd_branch", *req.EMDBranch)
	}
	if req.EMDBeneficiary != nil {
		addSet("emd_beneficiary", *req.EMDBeneficiary)
	}
	if req.EMDPayableAt != nil {
		addSet("emd_payable_at", *req.EMDPayableAt)
	}
	if req.BGRequired != nil {
		addSet("bg_required", *req.BGRequired)
	}
	if req.BGRate != nil {
		addSet("bg_rate", *req.BGRate)
	}
	if req.HighLevelScope != nil {
		addSet("high_level_scope", *req.HighLevelScope)
	}
	if req.Authority != nil {
		addSet("authority", *req.Authority)
	}
	startDateVal := req.StartDate
	if startDateVal == nil {
		startDateVal = req.OpeningDate
	}
	if startDateVal != nil {
		t, err := time.Parse(time.RFC3339, *startDateVal)
		if err == nil {
			addSet("start_date", t)
			addSet("opening_date", t)
		}
	}

	endDateVal := req.EndDate
	if endDateVal == nil {
		endDateVal = req.ClosingDate
	}
	if endDateVal != nil {
		t, err := time.Parse(time.RFC3339, *endDateVal)
		if err == nil {
			addSet("end_date", t)
			addSet("closing_date", t)
		}
	}
	if req.DurationMonths != nil {
		addSet("duration_months", *req.DurationMonths)
	}
	if req.FinanceAlerted != nil {
		addSet("finance_alerted", *req.FinanceAlerted)
	}
	if req.EMDReady != nil {
		addSet("emd_ready", *req.EMDReady)
	}
	if req.EMDReadyDate != nil {
		if t, err := time.Parse(time.RFC3339, *req.EMDReadyDate); err == nil {
			addSet("emd_ready_date", t)
		}
	}
	if req.EMDReturned != nil {
		addSet("emd_returned", *req.EMDReturned)
	}
	// A boolean explicitly flipped to false clears its companion date server-side —
	// JSON can't distinguish "clear this" from "don't touch this" for a *time.Time
	// via null vs. omitted (both unmarshal to a nil pointer), so we derive clearing
	// from the unambiguous boolean instead of relying on the client sending a date.
	if req.EMDReturned != nil && !*req.EMDReturned {
		addSet("emd_returned_date", nil)
	} else if req.EMDReturnedDate != nil {
		if t, err := time.Parse(time.RFC3339, *req.EMDReturnedDate); err == nil {
			addSet("emd_returned_date", t)
		}
	}
	if req.BGDischarged != nil {
		addSet("bg_discharged", *req.BGDischarged)
	}
	if req.BGDischarged != nil && !*req.BGDischarged {
		addSet("bg_discharged_date", nil)
	} else if req.BGDischargedDate != nil {
		if t, err := time.Parse(time.RFC3339, *req.BGDischargedDate); err == nil {
			addSet("bg_discharged_date", t)
		}
	}
	if req.BGTargetDate != nil {
		if t, err := time.Parse(time.RFC3339, *req.BGTargetDate); err == nil {
			addSet("bg_target_date", t)
		}
	}
	if req.POReceivedStatus != nil && *req.POReceivedStatus != "PO Received" {
		addSet("po_received_date", nil)
	} else if req.POReceivedDate != nil {
		if t, err := time.Parse(time.RFC3339, *req.POReceivedDate); err == nil {
			addSet("po_received_date", t)
		}
	}
	if req.DeliveryComplete != nil {
		addSet("delivery_complete", *req.DeliveryComplete)
	}
	if req.DeliveryComplete != nil && !*req.DeliveryComplete {
		addSet("delivery_complete_date", nil)
	} else if req.DeliveryCompleteDate != nil {
		if t, err := time.Parse(time.RFC3339, *req.DeliveryCompleteDate); err == nil {
			addSet("delivery_complete_date", t)
		}
	}
	if req.SubmissionDone != nil {
		addSet("submission_done", *req.SubmissionDone)
	}
	if req.GemSubmissionPrice != nil {
		addSet("gem_submission_price", *req.GemSubmissionPrice)
	}
	if req.QuotedPrice != nil {
		addSet("quoted_price", *req.QuotedPrice)
	}
	if req.FinalPrice != nil {
		addSet("final_price", *req.FinalPrice)
	}
	if req.TechnicalResult != nil {
		addSet("technical_result", *req.TechnicalResult)
	}
	if req.DisqualificationReason != nil {
		addSet("disqualification_reason", *req.DisqualificationReason)
	}
	if req.FinancialResult != nil {
		addSet("financial_result", *req.FinancialResult)
	}
	if req.L1CompanyName != nil {
		addSet("l1_company_name", *req.L1CompanyName)
	}
	if req.L1Price != nil {
		addSet("l1_price", *req.L1Price)
	}
	if req.PriceDifference != nil {
		addSet("price_difference", *req.PriceDifference)
	}
	if req.PriceDifferencePct != nil {
		addSet("price_difference_pct", *req.PriceDifferencePct)
	}
	if req.EligibilityRemarks != nil {
		addSet("eligibility_remarks", *req.EligibilityRemarks)
	}
	if req.EMDRemarks != nil {
		addSet("emd_remarks", *req.EMDRemarks)
	}
	if req.Remarks != nil {
		addSet("remarks", *req.Remarks)
	}
	if req.Team != nil {
		addSet("team", *req.Team)
	}
	if req.ScopeType != nil {
		addSet("scope_type", *req.ScopeType)
	}
	if req.ActivityType != nil {
		addSet("activity_type", *req.ActivityType)
	}
	if req.ExcelBidStatus != nil {
		addSet("excel_bid_status", *req.ExcelBidStatus)
	}
	if req.SubmissionStatus != nil {
		addSet("submission_status", *req.SubmissionStatus)
	}
	if req.FinancialEvaluationStatus != nil {
		addSet("financial_evaluation_status", *req.FinancialEvaluationStatus)
	}
	if req.POReceivedStatus != nil {
		addSet("po_received_status", *req.POReceivedStatus)
	}
	if req.BidResult != nil {
		addSet("bid_result", *req.BidResult)
	}
	if req.WorkflowStage != nil {
		addSet("workflow_stage", *req.WorkflowStage)
	}
	if req.BidStatus != nil {
		addSet("bid_status", *req.BidStatus)
	}
	if req.BidOutcome != nil {
		addSet("bid_outcome", *req.BidOutcome)
	}
	if req.StageCompletions != nil {
		b, err := json.Marshal(req.StageCompletions)
		if err == nil {
			addSet("stage_completions", b)
		}
	}
	if req.StageRemarks != nil {
		b, err := json.Marshal(req.StageRemarks)
		if err == nil {
			addSet("stage_remarks", b)
		}
	}
	if req.StageReviews != nil {
		b, err := json.Marshal(req.StageReviews)
		if err == nil {
			addSet("stage_reviews", b)
		}
	}
	if req.PricingWorkspace != nil {
		addSet("pricing_workspace", []byte(*req.PricingWorkspace))
	}
	if req.OEMWorkspace != nil {
		addSet("oem_workspace", []byte(*req.OEMWorkspace))
	}
	if req.ReportingManagerID != nil {
		addSet("reporting_manager_id", *req.ReportingManagerID)
	}
	if req.TechComplianceStatus != nil {
		addSet("tech_compliance_status", *req.TechComplianceStatus)
	}
	if req.QualificationStatus != nil {
		addSet("qualification_status", *req.QualificationStatus)
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE bid.bid_workspaces SET %s WHERE id = $%d AND archived_at IS NULL",
		strings.Join(sets, ", "), idx)
	_, err := r.pool.Exec(ctx, query, args...)
	return err
}

func (r *postgresBidRepo) UpdateStage(ctx context.Context, id string, stage string, status string) error {
	var err error
	if status == "ACTIVE" {
		_, err = r.pool.Exec(ctx,
			"UPDATE bid.bid_workspaces SET workflow_stage = $1, bid_status = $2, bid_outcome = NULL, updated_at = NOW() WHERE id = $3",
			stage, status, id,
		)
	} else {
		_, err = r.pool.Exec(ctx,
			"UPDATE bid.bid_workspaces SET workflow_stage = $1, bid_status = $2, updated_at = NOW() WHERE id = $3",
			stage, status, id,
		)
	}
	return err
}

func (r *postgresBidRepo) UpdateOutcome(ctx context.Context, id string, req *domain.RecordOutcomeRequest) error {
	competitorJSON, _ := json.Marshal(req.Competitors)

	sets := []string{
		"bid_outcome = $1",
		"bid_status = $2",
		"competitor_info = $3",
		"updated_at = NOW()",
	}
	args := []interface{}{req.BidOutcome, req.BidOutcome, competitorJSON}
	idx := 4

	addSet := func(col string, val interface{}) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, idx))
		args = append(args, val)
		idx++
	}

	if req.FinalBidValue != nil {
		addSet("final_bid_value", *req.FinalBidValue)
	}
	if req.L1Price != nil {
		addSet("l1_price", *req.L1Price)
	}
	if req.QuotedPrice != nil {
		addSet("quoted_price", *req.QuotedPrice)
	}
	if req.L1Price != nil && req.QuotedPrice != nil && *req.L1Price > 0 {
		diff := *req.QuotedPrice - *req.L1Price
		diffPct := (diff / *req.L1Price) * 100
		addSet("price_difference", diff)
		addSet("price_difference_pct", diffPct)
	}
	if req.OutcomeReason != nil {
		addSet("outcome_reason", *req.OutcomeReason)
	}
	if req.ResultDate != nil {
		t, err := time.Parse(time.RFC3339, *req.ResultDate)
		if err == nil {
			addSet("result_date", t)
		}
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE bid.bid_workspaces SET %s WHERE id = $%d AND archived_at IS NULL",
		strings.Join(sets, ", "), idx)
	_, err := r.pool.Exec(ctx, query, args...)
	return err
}

func (r *postgresBidRepo) SoftDelete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE bid.bid_workspaces SET archived_at = NOW(), bid_status = 'ARCHIVED', updated_at = NOW() WHERE id = $1",
		id,
	)
	return err
}

func (r *postgresBidRepo) Restore(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE bid.bid_workspaces SET archived_at = NULL, bid_status = 'ACTIVE', updated_at = NOW() WHERE id = $1",
		id,
	)
	return err
}

func (r *postgresBidRepo) PermanentDelete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx,
		"DELETE FROM bid.bid_workspaces WHERE id = $1",
		id,
	)
	return err
}

func (r *postgresBidRepo) CleanupExpired(ctx context.Context) error {
	_, err := r.pool.Exec(ctx,
		"DELETE FROM bid.bid_workspaces WHERE archived_at IS NOT NULL AND archived_at < NOW() - INTERVAL '15 days'",
	)
	return err
}

func (r *postgresBidRepo) AddMember(ctx context.Context, bidID string, userID string, role string, addedBy string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO bid.bid_workspace_members (bid_id, user_id, role, added_by) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (bid_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
		bidID, userID, role, addedBy,
	)
	return err
}

func (r *postgresBidRepo) RemoveMember(ctx context.Context, bidID string, userID string) error {
	_, err := r.pool.Exec(ctx,
		"DELETE FROM bid.bid_workspace_members WHERE bid_id = $1 AND user_id = $2",
		bidID, userID,
	)
	return err
}

func (r *postgresBidRepo) GetMembers(ctx context.Context, bidID string) ([]domain.MemberResponse, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT m.user_id, COALESCE(u.full_name, u.username), u.username, m.role, m.added_at
		FROM bid.bid_workspace_members m
		JOIN auth.users u ON u.id = m.user_id
		WHERE m.bid_id = $1
		ORDER BY m.added_at ASC
	`, bidID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []domain.MemberResponse
	for rows.Next() {
		var m domain.MemberResponse
		if err := rows.Scan(&m.UserID, &m.FullName, &m.Username, &m.Role, &m.AddedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	if members == nil {
		members = []domain.MemberResponse{}
	}
	return members, nil
}

func (r *postgresBidRepo) AddStageHistory(ctx context.Context, h *domain.BidStageHistory) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO bid.bid_stage_history (bid_id, from_stage, to_stage, transition_reason, transitioned_by, event_type, details)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		h.BidID, h.FromStage, h.ToStage, h.TransitionReason, h.TransitionedBy, h.EventType, h.Details,
	)
	return err
}

func (r *postgresBidRepo) GetStageHistory(ctx context.Context, bidID string) ([]domain.BidStageHistory, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, bid_id, from_stage, to_stage, transition_reason, transitioned_by, event_type, details, created_at
		FROM bid.bid_stage_history
		WHERE bid_id = $1
		ORDER BY created_at ASC
	`, bidID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []domain.BidStageHistory
	for rows.Next() {
		var h domain.BidStageHistory
		if err := rows.Scan(&h.ID, &h.BidID, &h.FromStage, &h.ToStage, &h.TransitionReason, &h.TransitionedBy, &h.EventType, &h.Details, &h.CreatedAt); err != nil {
			return nil, err
		}
		history = append(history, h)
	}
	if history == nil {
		history = []domain.BidStageHistory{}
	}
	return history, nil
}

func (r *postgresBidRepo) BulkInsertChecklists(ctx context.Context, bidID string, titles []string) error {
	if len(titles) == 0 {
		return nil
	}
	for i, title := range titles {
		group := "BIDDER"
		if strings.HasPrefix(title, "[OEM]") {
			group = "OEM"
		}
		_, err := r.pool.Exec(ctx,
			`INSERT INTO bid.bid_checklists (bid_id, title, sort_order, checklist_group) VALUES ($1, $2, $3, $4)`,
			bidID, title, i, group,
		)
		if err != nil {
			return fmt.Errorf("insert checklist %q: %w", title, err)
		}
	}
	return nil
}

func (r *postgresBidRepo) GetChecklists(ctx context.Context, bidID string) ([]domain.BidChecklist, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, bid_id, title, is_done, done_by, done_at, sort_order, checklist_group, created_at
		 FROM bid.bid_checklists WHERE bid_id = $1 ORDER BY sort_order ASC, created_at ASC`,
		bidID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.BidChecklist
	for rows.Next() {
		var c domain.BidChecklist
		if err := rows.Scan(&c.ID, &c.BidID, &c.Title, &c.IsDone, &c.DoneBy, &c.DoneAt, &c.SortOrder, &c.ChecklistGroup, &c.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	if items == nil {
		items = []domain.BidChecklist{}
	}
	return items, nil
}

func (r *postgresBidRepo) AddChecklist(ctx context.Context, bidID string, title string, sortOrder int) (*domain.BidChecklist, error) {
	var c domain.BidChecklist
	err := r.pool.QueryRow(ctx,
		`INSERT INTO bid.bid_checklists (bid_id, title, sort_order, checklist_group)
		 VALUES ($1, $2, $3, 'CUSTOM')
		 RETURNING id, bid_id, title, is_done, done_by, done_at, sort_order, checklist_group, created_at`,
		bidID, title, sortOrder,
	).Scan(&c.ID, &c.BidID, &c.Title, &c.IsDone, &c.DoneBy, &c.DoneAt, &c.SortOrder, &c.ChecklistGroup, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *postgresBidRepo) UpdateChecklist(ctx context.Context, checklistID string, title *string, sortOrder *int) error {
	sets := []string{}
	args := []interface{}{}
	idx := 1
	if title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", idx))
		args = append(args, *title)
		idx++
	}
	if sortOrder != nil {
		sets = append(sets, fmt.Sprintf("sort_order = $%d", idx))
		args = append(args, *sortOrder)
		idx++
	}
	if len(sets) == 0 {
		return nil
	}
	args = append(args, checklistID)
	_, err := r.pool.Exec(ctx,
		fmt.Sprintf("UPDATE bid.bid_checklists SET %s WHERE id = $%d",
			strings.Join(sets, ", "), idx),
		args...,
	)
	return err
}

func (r *postgresBidRepo) DeleteChecklist(ctx context.Context, checklistID string) error {
	_, err := r.pool.Exec(ctx,
		"DELETE FROM bid.bid_checklists WHERE id = $1",
		checklistID,
	)
	return err
}

func (r *postgresBidRepo) ReorderChecklists(ctx context.Context, items []domain.ReorderChecklistItem) error {
	for _, item := range items {
		_, err := r.pool.Exec(ctx,
			"UPDATE bid.bid_checklists SET sort_order = $1 WHERE id = $2",
			item.SortOrder, item.ID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *postgresBidRepo) ToggleChecklist(ctx context.Context, checklistID string, isDone bool, doneBy string) error {
	var err error
	if isDone {
		_, err = r.pool.Exec(ctx,
			`UPDATE bid.bid_checklists SET is_done = true, done_by = $1, done_at = NOW() WHERE id = $2`,
			doneBy, checklistID,
		)
	} else {
		_, err = r.pool.Exec(ctx,
			`UPDATE bid.bid_checklists SET is_done = false, done_by = NULL, done_at = NULL WHERE id = $1`,
			checklistID,
		)
	}
	return err
}

func (r *postgresBidRepo) GetUserSummary(ctx context.Context, userID string) (*domain.UserSummary, error) {
	var u domain.UserSummary
	err := r.pool.QueryRow(ctx, `
		SELECT u.id, COALESCE(u.full_name, u.username), u.username,
		       COALESCE((
		           SELECT r.name FROM auth.user_roles ur
		           JOIN auth.roles r ON r.id = ur.role_id
		           WHERE ur.user_id = u.id
		           ORDER BY ur.is_primary DESC, ur.role_order ASC
		           LIMIT 1
		       ), 'USER')
		FROM auth.users u WHERE u.id = $1
	`, userID).Scan(&u.ID, &u.FullName, &u.Username, &u.Role)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *postgresBidRepo) GetGlobalAuditLogs(ctx context.Context, limit int) ([]domain.GlobalAuditItem, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		SELECT h.id, h.bid_id, COALESCE(b.title, 'Deleted Bid'), h.from_stage, h.to_stage,
		       h.transition_reason, h.transitioned_by, h.created_at,
		       COALESCE(u.full_name, u.username, 'System User'), COALESCE(u.username, 'system'),
		       COALESCE((
		           SELECT r.name FROM auth.user_roles ur
		           JOIN auth.roles r ON r.id = ur.role_id
		           WHERE ur.user_id = u.id
		           ORDER BY ur.is_primary DESC, ur.role_order ASC
		           LIMIT 1
		       ), 'USER')
		FROM bid.bid_stage_history h
		LEFT JOIN bid.bid_workspaces b ON b.id = h.bid_id
		LEFT JOIN auth.users u ON u.id = h.transitioned_by
		ORDER BY h.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []domain.GlobalAuditItem
	for rows.Next() {
		var item domain.GlobalAuditItem
		var user domain.UserSummary
		if err := rows.Scan(&item.ID, &item.BidID, &item.BidTitle, &item.FromStage, &item.ToStage,
			&item.TransitionReason, &item.TransitionedBy.ID, &item.CreatedAt,
			&user.FullName, &user.Username, &user.Role); err != nil {
			return nil, err
		}
		user.ID = item.TransitionedBy.ID
		item.TransitionedBy = user
		logs = append(logs, item)
	}
	if logs == nil {
		logs = []domain.GlobalAuditItem{}
	}
	return logs, nil
}

// ────────────────────────────────────────
// Internal scan helpers
// ────────────────────────────────────────

type scannable interface {
	Scan(dest ...interface{}) error
}

func scanBid(row scannable) (*domain.BidWorkspace, error) {
	return scanBidFields(row)
}

func scanBidFromRows(rows interface {
	Scan(dest ...interface{}) error
}) (*domain.BidWorkspace, error) {
	return scanBidFields(rows)
}

func scanBidFields(s scannable) (*domain.BidWorkspace, error) {
	var b domain.BidWorkspace
	err := s.Scan(
		&b.ID, &b.BidNo, &b.GemBidNo, &b.Title, &b.OrganizationName, &b.DepartmentName,
		&b.PortalSource, &b.CreationMode, &b.WorkflowStage, &b.BidStatus,
		&b.BidOwnerID, &b.ReportingManagerID, &b.CreatedBy,
		&b.EstimatedValue, &b.EMDAmount, &b.EMDType, &b.EMDExempted,
		&b.EMDExemptionType, &b.EMDExemptionReason,
		&b.FinalBidValue, &b.L1Price, &b.QuotedPrice,
		&b.StartDate, &b.EndDate, &b.OpeningDate, &b.ClosingDate, &b.DurationMonths, &b.Authority,
		&b.HighLevelScope, &b.BGRequired, &b.BGRate,
		&b.Category, &b.BidType, &b.GemBidType,
		&b.QualificationStatus, &b.BidOutcome, &b.OutcomeReason, &b.TechComplianceStatus,
		&b.Remarks, &b.CompetitorInfo, &b.Metadata,
		&b.AISourceDocumentID, &b.AIExtractionConfidence,
		&b.CreatedAt, &b.UpdatedAt, &b.ArchivedAt,
		&b.Team, &b.ScopeType, &b.ActivityType,
		&b.ExcelBidStatus, &b.SubmissionStatus, &b.FinancialEvaluationStatus, &b.POReceivedStatus,
		&b.BidResult,
		&b.FinanceAlerted, &b.EMDReady, &b.EMDReturned, &b.BGDischarged, &b.SubmissionDone,
		&b.GemSubmissionPrice, &b.FinalPrice,
		&b.TechnicalResult, &b.DisqualificationReason, &b.FinancialResult,
		&b.L1CompanyName, &b.PriceDifference, &b.PriceDifferencePct,
		&b.EligibilityRemarks, &b.EMDRemarks,
		&b.StageCompletions, &b.StageRemarks, &b.StageReviews,
		&b.PricingWorkspace, &b.OEMWorkspace,
		&b.EMDBankName, &b.EMDAccountNumber, &b.EMDIFSCCode, &b.EMDBranch,
		&b.EMDBeneficiary, &b.EMDPayableAt,
		&b.POReceivedDate, &b.BGTargetDate, &b.BGDischargedDate, &b.EMDReturnedDate,
		&b.EMDReadyDate, &b.DeliveryComplete, &b.DeliveryCompleteDate,
	)
	if err != nil {
		return nil, fmt.Errorf("scan bid: %w", err)
	}
	return &b, nil
}

func (r *postgresBidRepo) BulkInsertChecklistsWithGroup(ctx context.Context, bidID string, titles []string, group string) error {
	for i, title := range titles {
		_, err := r.pool.Exec(ctx,
			`INSERT INTO bid.bid_checklists (bid_id, title, sort_order, checklist_group) VALUES ($1, $2, $3, $4)`,
			bidID, title, i, group,
		)
		if err != nil {
			return fmt.Errorf("insert checklist %q: %w", title, err)
		}
	}
	return nil
}

func (r *postgresBidRepo) GetChecklistsByGroup(ctx context.Context, bidID string, group string) ([]domain.BidChecklist, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, bid_id, title, is_done, done_by, done_at, sort_order, checklist_group, created_at
		 FROM bid.bid_checklists WHERE bid_id = $1 AND checklist_group = $2 ORDER BY sort_order ASC, created_at ASC`,
		bidID, group,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.BidChecklist
	for rows.Next() {
		var c domain.BidChecklist
		if err := rows.Scan(&c.ID, &c.BidID, &c.Title, &c.IsDone, &c.DoneBy, &c.DoneAt, &c.SortOrder, &c.ChecklistGroup, &c.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	if items == nil {
		items = []domain.BidChecklist{}
	}
	return items, nil
}

func (r *postgresBidRepo) AddChecklistWithGroup(ctx context.Context, bidID string, title string, sortOrder int, group string) (*domain.BidChecklist, error) {
	var c domain.BidChecklist
	err := r.pool.QueryRow(ctx,
		`INSERT INTO bid.bid_checklists (bid_id, title, sort_order, checklist_group)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, bid_id, title, is_done, done_by, done_at, sort_order, checklist_group, created_at`,
		bidID, title, sortOrder, group,
	).Scan(&c.ID, &c.BidID, &c.Title, &c.IsDone, &c.DoneBy, &c.DoneAt, &c.SortOrder, &c.ChecklistGroup, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *postgresBidRepo) GetTenderPerformanceMatrix(ctx context.Context, ownerID string) ([]domain.TenderOwnerPerformanceStat, error) {
	// archived_at IS NULL is applied once here (not per-FILTER) so every
	// column — including "Total" — consistently excludes binned/deleted
	// tenders; previously "Total" counted them while some other columns
	// didn't, so the matrix could disagree with the tenders list itself.
	where := "WHERE b.archived_at IS NULL"
	args := []interface{}{}
	if ownerID != "" {
		where += " AND u.id = $1"
		args = append(args, ownerID)
	}

	query := fmt.Sprintf(`
		SELECT
			u.id                                             AS user_id,
			COALESCE(u.full_name, u.username)                AS full_name,
			u.username,
			COALESCE(
				(SELECT r.name
				 FROM auth.user_roles ur
				 JOIN auth.roles r ON r.id = ur.role_id
				 WHERE ur.user_id = u.id
				 ORDER BY r.name
				 LIMIT 1),
				'USER'
			)                                                AS role,
			COUNT(*)                                         AS total,
			COUNT(*) FILTER (
				WHERE b.bid_status NOT IN ('WON', 'LOST', 'CANCELLED')
				AND b.workflow_stage NOT IN ('WON', 'LOST', 'CANCELLED', 'GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER')
				AND COALESCE(b.bid_outcome, '') NOT IN ('WON', 'LOST', 'CANCELLED')
				AND COALESCE(b.technical_result, '') != 'DISQUALIFIED'
			)                                                AS active,
			COUNT(*) FILTER (
				WHERE (b.submission_done = true
					OR b.workflow_stage IN ('GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER')
					OR b.submission_status = 'SUBMITTED'
					OR b.bid_status = 'SUBMITTED')
			)                                                AS submitted,
			COUNT(*) FILTER (
				WHERE b.workflow_stage = 'TECHNICAL_EVALUATION'
					OR b.bid_status = 'TECHNICAL_EVALUATION'
			)                                                AS tech_eval,
			COUNT(*) FILTER (
				WHERE b.workflow_stage = 'FINANCIAL_EVALUATION'
			)                                                AS fin_eval,
			COUNT(*) FILTER (
				WHERE b.workflow_stage = 'AWARD_HANDOVER'
			)                                                AS award,
			COUNT(*) FILTER (
				WHERE b.bid_status = 'WON'
					OR b.workflow_stage = 'WON'
					OR b.bid_outcome = 'WON'
			)                                                AS won,
			COUNT(*) FILTER (
				WHERE b.bid_status = 'LOST'
					OR b.workflow_stage = 'LOST'
					OR b.bid_outcome = 'LOST'
					OR b.technical_result = 'DISQUALIFIED'
			)                                                AS lost,
			COUNT(*) FILTER (
				WHERE b.bid_status = 'CANCELLED'
					OR b.workflow_stage = 'CANCELLED'
					OR b.bid_outcome = 'CANCELLED'
			)                                                AS cancelled
		FROM bid.bid_workspaces b
		JOIN auth.users u ON u.id = b.bid_owner_id
		%s
		GROUP BY u.id, u.full_name, u.username
		ORDER BY COUNT(*) DESC, COALESCE(u.full_name, u.username) ASC
	`, where)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("performance matrix query: %w", err)
	}
	defer rows.Close()

	var stats []domain.TenderOwnerPerformanceStat
	for rows.Next() {
		var s domain.TenderOwnerPerformanceStat
		if err := rows.Scan(
			&s.UserID, &s.FullName, &s.Username, &s.Role,
			&s.Total, &s.Active, &s.Submitted, &s.TechEval,
			&s.FinEval, &s.Award, &s.Won, &s.Lost, &s.Cancelled,
		); err != nil {
			return nil, fmt.Errorf("scan performance matrix row: %w", err)
		}
		stats = append(stats, s)
	}
	if stats == nil {
		stats = []domain.TenderOwnerPerformanceStat{}
	}
	return stats, nil
}


func calcPages(total, limit int) int {
	if limit == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}
