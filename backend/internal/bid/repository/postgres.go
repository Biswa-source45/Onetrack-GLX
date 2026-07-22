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

func (r *postgresBidRepo) Create(ctx context.Context, bid *domain.CreateBidParams) (string, error) {
	query := `
		INSERT INTO bid.bid_workspaces (
			bid_no, gem_bid_no, title, organization_name, department_name,
			portal_source, creation_mode, workflow_stage, bid_status,
			bid_owner_id, technical_manager_id, created_by,
			estimated_value, emd_amount, emd_type, emd_exempted,
			oem_required, has_tech_eval,
			opening_date, closing_date,
			category, bid_type, gem_bid_type,
			remarks, metadata,
			team, scope_type, bg_rate, activity_type, target_month_date,
			excel_bid_status, submission_status, financial_evaluation_status, po_received_status,
			bid_result
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12,
			$13, $14, $15, $16,
			$17, $18,
			$19, $20,
			$21, $22, $23,
			$24, $25,
			$26, $27, $28, $29, $30,
			$31, $32, $33, $34, $35
		) RETURNING id
	`
	var id string
	err := r.pool.QueryRow(ctx, query,
		bid.BidNo, bid.GemBidNo, bid.Title, bid.OrganizationName, bid.DepartmentName,
		bid.PortalSource, bid.CreationMode, domain.StageDiscovered, domain.BidStatusActive,
		bid.BidOwnerID, bid.TechnicalManagerID, bid.CreatedBy,
		bid.EstimatedValue, bid.EMDAmount, bid.EMDType, bid.EMDExempted,
		bid.OEMRequired, bid.HasTechEval,
		bid.OpeningDate, bid.ClosingDate,
		bid.Category, bid.BidType, bid.GemBidType,
		bid.Remarks, bid.Metadata,
		bid.Team, bid.ScopeType, bid.BGRate, bid.ActivityType, bid.TargetMonthDate,
		bid.ExcelBidStatus, bid.SubmissionStatus, bid.FinancialEvaluationStatus, bid.POReceivedStatus,
		bid.BidResult,
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
		       bid_owner_id, technical_manager_id, created_by,
		       estimated_value, emd_amount, emd_type, emd_exempted,
		       final_bid_value, l1_price, quoted_price,
		       opening_date, closing_date, submission_date, result_date, ra_date,
		       category, bid_type, gem_bid_type, oem_required, has_tech_eval,
		       qualification_status, bid_outcome, outcome_reason, tech_compliance_status,
		       remarks, competitor_info, metadata,
		       ai_source_document_id, ai_extraction_confidence,
		       created_at, updated_at, archived_at,
		       team, scope_type, bg_rate, activity_type, target_month_date,
		       excel_bid_status, submission_status, financial_evaluation_status, po_received_status,
		       bid_result
		FROM bid.bid_workspaces
		WHERE id = $1 AND archived_at IS NULL
	`
	row := r.pool.QueryRow(ctx, query, id)
	return scanBid(row)
}

func (r *postgresBidRepo) List(ctx context.Context, params domain.ListBidsParams) ([]domain.BidWorkspace, int, map[string]int, error) {
	conditions := []string{"b.archived_at IS NULL"}
	args := []interface{}{}
	idx := 1

	if params.Search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(b.title ILIKE $%d OR b.bid_no ILIKE $%d OR b.gem_bid_no ILIKE $%d)",
			idx, idx+1, idx+2,
		))
		search := "%" + params.Search + "%"
		args = append(args, search, search, search)
		idx += 3
	}
	if params.WorkflowStage != "" {
		conditions = append(conditions, fmt.Sprintf("b.workflow_stage = $%d", idx))
		args = append(args, params.WorkflowStage)
		idx++
	}
	if params.BidStatus != "" {
		conditions = append(conditions, fmt.Sprintf("b.bid_status = $%d", idx))
		args = append(args, params.BidStatus)
		idx++
	}
	if params.BidOutcome != "" {
		conditions = append(conditions, fmt.Sprintf("b.bid_outcome = $%d", idx))
		args = append(args, params.BidOutcome)
		idx++
	}
	if params.BidOwnerID != "" {
		conditions = append(conditions, fmt.Sprintf("b.bid_owner_id = $%d", idx))
		args = append(args, params.BidOwnerID)
		idx++
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

	statusQuery := fmt.Sprintf(`
		SELECT COALESCE(b.bid_status, 'ACTIVE'), COUNT(*)
		FROM bid.bid_workspaces b
		%s
		GROUP BY b.bid_status
	`, where)

	rowsStatus, err := r.pool.Query(ctx, statusQuery, args...)
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

	var total int
	for _, c := range statusCounts {
		total += c
	}

	offset := (params.Page - 1) * params.Limit
	listArgs := append(args, params.Limit, offset)
	dataQuery := fmt.Sprintf(`
		SELECT b.id, b.bid_no, b.gem_bid_no, b.title, b.organization_name, b.department_name,
		       b.portal_source, b.creation_mode, b.workflow_stage, b.bid_status,
		       b.bid_owner_id, b.technical_manager_id, b.created_by,
		       b.estimated_value, b.emd_amount, b.emd_type, b.emd_exempted,
		       b.final_bid_value, b.l1_price, b.quoted_price,
		       b.opening_date, b.closing_date, b.submission_date, b.result_date, b.ra_date,
		       b.category, b.bid_type, b.gem_bid_type, b.oem_required, b.has_tech_eval,
		       b.qualification_status, b.bid_outcome, b.outcome_reason, b.tech_compliance_status,
		       b.remarks, b.competitor_info, b.metadata,
		       b.ai_source_document_id, b.ai_extraction_confidence,
		       b.created_at, b.updated_at, b.archived_at,
		       b.team, b.scope_type, b.bg_rate, b.activity_type, b.target_month_date,
		       b.excel_bid_status, b.submission_status, b.financial_evaluation_status, b.po_received_status,
		       b.bid_result
		FROM bid.bid_workspaces b
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
	if req.OEMRequired != nil {
		addSet("oem_required", *req.OEMRequired)
	}
	if req.HasTechEval != nil {
		addSet("has_tech_eval", *req.HasTechEval)
	}
	if req.OpeningDate != nil {
		t, err := time.Parse(time.RFC3339, *req.OpeningDate)
		if err == nil {
			addSet("opening_date", t)
		}
	}
	if req.ClosingDate != nil {
		t, err := time.Parse(time.RFC3339, *req.ClosingDate)
		if err == nil {
			addSet("closing_date", t)
		}
	}
	if req.SubmissionDate != nil {
		t, err := time.Parse(time.RFC3339, *req.SubmissionDate)
		if err == nil {
			addSet("submission_date", t)
		}
	}
	if req.ResultDate != nil {
		t, err := time.Parse(time.RFC3339, *req.ResultDate)
		if err == nil {
			addSet("result_date", t)
		}
	}
	if req.RADate != nil {
		t, err := time.Parse(time.RFC3339, *req.RADate)
		if err == nil {
			addSet("ra_date", t)
		}
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
	if req.BGRate != nil {
		addSet("bg_rate", *req.BGRate)
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
	if req.BidStatus != nil {
		addSet("bid_status", *req.BidStatus)
	}
	if req.BidOutcome != nil {
		addSet("bid_outcome", *req.BidOutcome)
	}
	if req.TechnicalManagerID != nil {
		addSet("technical_manager_id", *req.TechnicalManagerID)
	}
	if req.TechComplianceStatus != nil {
		addSet("tech_compliance_status", *req.TechComplianceStatus)
	}
	if req.QualificationStatus != nil {
		addSet("qualification_status", *req.QualificationStatus)
	}
	if req.TargetMonthDate != nil {
		t, err := time.Parse(time.RFC3339, *req.TargetMonthDate)
		if err == nil {
			addSet("target_month_date", t)
		}
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE bid.bid_workspaces SET %s WHERE id = $%d AND archived_at IS NULL",
		strings.Join(sets, ", "), idx)
	_, err := r.pool.Exec(ctx, query, args...)
	return err
}

func (r *postgresBidRepo) UpdateStage(ctx context.Context, id string, stage string, status string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE bid.bid_workspaces SET workflow_stage = $1, bid_status = $2, updated_at = NOW() WHERE id = $3",
		stage, status, id,
	)
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
		`INSERT INTO bid.bid_stage_history (bid_id, from_stage, to_stage, transition_reason, transitioned_by)
		 VALUES ($1, $2, $3, $4, $5)`,
		h.BidID, h.FromStage, h.ToStage, h.TransitionReason, h.TransitionedBy,
	)
	return err
}

func (r *postgresBidRepo) GetStageHistory(ctx context.Context, bidID string) ([]domain.BidStageHistory, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, bid_id, from_stage, to_stage, transition_reason, transitioned_by, created_at
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
		if err := rows.Scan(&h.ID, &h.BidID, &h.FromStage, &h.ToStage, &h.TransitionReason, &h.TransitionedBy, &h.CreatedAt); err != nil {
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
		_, err := r.pool.Exec(ctx,
			`INSERT INTO bid.bid_checklists (bid_id, title, sort_order) VALUES ($1, $2, $3)`,
			bidID, title, i,
		)
		if err != nil {
			return fmt.Errorf("insert checklist %q: %w", title, err)
		}
	}
	return nil
}

func (r *postgresBidRepo) GetChecklists(ctx context.Context, bidID string) ([]domain.BidChecklist, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, bid_id, title, is_done, done_by, done_at, sort_order, created_at
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
		if err := rows.Scan(&c.ID, &c.BidID, &c.Title, &c.IsDone, &c.DoneBy, &c.DoneAt, &c.SortOrder, &c.CreatedAt); err != nil {
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
		`INSERT INTO bid.bid_checklists (bid_id, title, sort_order)
		 VALUES ($1, $2, $3)
		 RETURNING id, bid_id, title, is_done, done_by, done_at, sort_order, created_at`,
		bidID, title, sortOrder,
	).Scan(&c.ID, &c.BidID, &c.Title, &c.IsDone, &c.DoneBy, &c.DoneAt, &c.SortOrder, &c.CreatedAt)
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
	err := r.pool.QueryRow(ctx,
		"SELECT id, COALESCE(full_name, username), username FROM auth.users WHERE id = $1",
		userID,
	).Scan(&u.ID, &u.FullName, &u.Username)
	if err != nil {
		return nil, err
	}
	return &u, nil
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
		&b.BidOwnerID, &b.TechnicalManagerID, &b.CreatedBy,
		&b.EstimatedValue, &b.EMDAmount, &b.EMDType, &b.EMDExempted,
		&b.FinalBidValue, &b.L1Price, &b.QuotedPrice,
		&b.OpeningDate, &b.ClosingDate, &b.SubmissionDate, &b.ResultDate, &b.RADate,
		&b.Category, &b.BidType, &b.GemBidType, &b.OEMRequired, &b.HasTechEval,
		&b.QualificationStatus, &b.BidOutcome, &b.OutcomeReason, &b.TechComplianceStatus,
		&b.Remarks, &b.CompetitorInfo, &b.Metadata,
		&b.AISourceDocumentID, &b.AIExtractionConfidence,
		&b.CreatedAt, &b.UpdatedAt, &b.ArchivedAt,
		&b.Team, &b.ScopeType, &b.BGRate, &b.ActivityType, &b.TargetMonthDate,
		&b.ExcelBidStatus, &b.SubmissionStatus, &b.FinancialEvaluationStatus, &b.POReceivedStatus,
		&b.BidResult,
	)
	if err != nil {
		return nil, fmt.Errorf("scan bid: %w", err)
	}
	return &b, nil
}

func calcPages(total, limit int) int {
	if limit == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}
