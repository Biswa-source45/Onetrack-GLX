package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/onetrack/backend/internal/bid/domain"
)

type bidService struct {
	repo domain.BidRepository
}

func NewBidService(repo domain.BidRepository) domain.BidService {
	return &bidService{repo: repo}
}

func (s *bidService) CreateBid(ctx context.Context, req *domain.CreateBidRequest, createdBy string) (*domain.BidResponse, error) {
	params := &domain.CreateBidParams{
		BidNo:              req.BidNo,
		GemBidNo:           req.GemBidNo,
		Title:              req.Title,
		OrganizationName:   req.OrganizationName,
		DepartmentName:     req.DepartmentName,
		PortalSource:       "GeM",
		CreationMode:       req.CreationMode,
		BidOwnerID:         req.BidOwnerID,
		TechnicalManagerID: req.TechnicalManagerID,
		CreatedBy:          createdBy,
		EstimatedValue:     req.EstimatedValue,
		EMDAmount:          req.EMDAmount,
		EMDType:            req.EMDType,
		Category:           req.Category,
		BidType:            req.BidType,
		GemBidType:         req.GemBidType,
		Remarks:            req.Remarks,
		Metadata:           []byte("{}"),
	}

	if req.PortalSource != nil {
		params.PortalSource = *req.PortalSource
	}
	if req.EMDExempted != nil {
		params.EMDExempted = *req.EMDExempted
	}
	if req.OEMRequired != nil {
		params.OEMRequired = *req.OEMRequired
	}
	if req.HasTechEval != nil {
		params.HasTechEval = *req.HasTechEval
	}
	if req.OpeningDate != nil {
		t, err := time.Parse(time.RFC3339, *req.OpeningDate)
		if err != nil {
			return nil, fmt.Errorf("invalid opening_date format: %w", err)
		}
		params.OpeningDate = &t
	}
	if req.ClosingDate != nil {
		t, err := time.Parse(time.RFC3339, *req.ClosingDate)
		if err != nil {
			return nil, fmt.Errorf("invalid closing_date format: %w", err)
		}
		params.ClosingDate = &t
	}
	if req.Metadata != nil {
		params.Metadata = []byte(*req.Metadata)
	}

	params.Team = req.Team
	params.ScopeType = req.ScopeType
	params.BGRate = req.BGRate
	params.ActivityType = req.ActivityType
	params.ExcelBidStatus = req.ExcelBidStatus
	params.SubmissionStatus = req.SubmissionStatus
	params.FinancialEvaluationStatus = req.FinancialEvaluationStatus
	params.POReceivedStatus = req.POReceivedStatus
	params.BidResult = req.BidResult

	if req.TargetMonthDate != nil {
		t, err := time.Parse(time.RFC3339, *req.TargetMonthDate)
		if err != nil {
			return nil, fmt.Errorf("invalid target_month_date format: %w", err)
		}
		params.TargetMonthDate = &t
	}

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

	// Auto-add technical manager as MANAGER member if set
	if req.TechnicalManagerID != nil {
		_ = s.repo.AddMember(ctx, id, *req.TechnicalManagerID, "MANAGER", createdBy)
	}

	// Seed checklists if provided
	if len(req.Checklists) > 0 {
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

	var techManager *domain.UserSummary
	if bid.TechnicalManagerID != nil {
		tm, err := s.repo.GetUserSummary(ctx, *bid.TechnicalManagerID)
		if err == nil {
			techManager = tm
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

	return buildBidResponse(bid, owner, techManager, members, checklistItems), nil
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
	if params.Limit < 1 || params.Limit > 100 {
		params.Limit = 20
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
		Bids:        items,
		Total:       total,
		Page:        params.Page,
		Limit:       params.Limit,
		TotalPages:  int(math.Ceil(float64(total) / float64(params.Limit))),
		ActiveCount: statusCounts["ACTIVE"],
		WonCount:    statusCounts["WON"],
		LostCount:   statusCounts["LOST"],
	}, nil
}

func (s *bidService) UpdateBid(ctx context.Context, id string, req *domain.UpdateBidRequest) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.Update(ctx, id, req)
}

func (s *bidService) TransitionStage(ctx context.Context, id string, req *domain.TransitionStageRequest, actorID string) (*domain.TransitionResult, error) {
	bid, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if IsTerminalStage(bid.WorkflowStage) {
		return nil, fmt.Errorf("bid is in a terminal stage: %s", bid.WorkflowStage)
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

	if err := s.repo.UpdateStage(ctx, id, req.TargetStage, newStatus); err != nil {
		return nil, fmt.Errorf("update stage: %w", err)
	}

	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            id,
		FromStage:        &prevStage,
		ToStage:          req.TargetStage,
		TransitionReason: req.Reason,
		TransitionedBy:   actorID,
	})

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
			CreatedAt:        h.CreatedAt,
		})
	}
	return result, nil
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

// ────────────────────────────────────────
// Response builders
// ────────────────────────────────────────

func buildBidResponse(bid *domain.BidWorkspace, owner *domain.UserSummary, techManager *domain.UserSummary, members []domain.MemberResponse, checklists []domain.BidChecklistItem) *domain.BidResponse {
	var competitorInfo interface{} = []interface{}{}
	var metadata interface{} = map[string]interface{}{}

	if len(bid.CompetitorInfo) > 0 {
		_ = json.Unmarshal(bid.CompetitorInfo, &competitorInfo)
	}
	if len(bid.Metadata) > 0 {
		_ = json.Unmarshal(bid.Metadata, &metadata)
	}

	return &domain.BidResponse{
		ID:               bid.ID,
		BidNo:            bid.BidNo,
		GemBidNo:         bid.GemBidNo,
		Title:            bid.Title,
		OrganizationName: bid.OrganizationName,
		DepartmentName:   bid.DepartmentName,
		PortalSource:     bid.PortalSource,
		CreationMode:     bid.CreationMode,
		WorkflowStage:    bid.WorkflowStage,
		BidStatus:        bid.BidStatus,
		EstimatedValue:   bid.EstimatedValue,
		EMDAmount:        bid.EMDAmount,
		EMDType:          bid.EMDType,
		EMDExempted:      bid.EMDExempted,
		FinalBidValue:    bid.FinalBidValue,
		L1Price:          bid.L1Price,
		QuotedPrice:      bid.QuotedPrice,
		OpeningDate:      bid.OpeningDate,
		ClosingDate:      bid.ClosingDate,
		SubmissionDate:   bid.SubmissionDate,
		ResultDate:       bid.ResultDate,
		RADate:           bid.RADate,
		Category:         bid.Category,
		BidType:          bid.BidType,
		GemBidType:       bid.GemBidType,
		OEMRequired:      bid.OEMRequired,
		HasTechEval:      bid.HasTechEval,
		QualificationStatus:    bid.QualificationStatus,
		BidOutcome:       bid.BidOutcome,
		OutcomeReason:    bid.OutcomeReason,
		TechComplianceStatus:   bid.TechComplianceStatus,
		Remarks:          bid.Remarks,
		CompetitorInfo:   competitorInfo,
		Metadata:         metadata,
		BidOwner:         *owner,
		TechnicalManager: techManager,
		Members:          members,
		Checklists:       checklists,
		CreatedBy:        bid.CreatedBy,
		AISourceDocumentID:     bid.AISourceDocumentID,
		AIExtractionConfidence: bid.AIExtractionConfidence,
		Team:                      bid.Team,
		ScopeType:                 bid.ScopeType,
		BGRate:                    bid.BGRate,
		ActivityType:              bid.ActivityType,
		TargetMonthDate:           bid.TargetMonthDate,
		ExcelBidStatus:            bid.ExcelBidStatus,
		SubmissionStatus:          bid.SubmissionStatus,
		FinancialEvaluationStatus: bid.FinancialEvaluationStatus,
		POReceivedStatus:          bid.POReceivedStatus,
		BidResult:                 bid.BidResult,
		CreatedAt:        bid.CreatedAt,
		UpdatedAt:        bid.UpdatedAt,
		ArchivedAt:       bid.ArchivedAt,
	}
}

func buildBidListItem(bid *domain.BidWorkspace, owner *domain.UserSummary) domain.BidListItem {
	return domain.BidListItem{
		ID:               bid.ID,
		BidNo:            bid.BidNo,
		GemBidNo:         bid.GemBidNo,
		Title:            bid.Title,
		OrganizationName: bid.OrganizationName,
		DepartmentName:   bid.DepartmentName,
		PortalSource:     bid.PortalSource,
		Category:         bid.Category,
		BidType:          bid.BidType,
		CreationMode:     bid.CreationMode,
		WorkflowStage:    bid.WorkflowStage,
		BidStatus:        bid.BidStatus,
		BidOutcome:       bid.BidOutcome,
		EstimatedValue:   bid.EstimatedValue,
		EMDAmount:        bid.EMDAmount,
		EMDType:          bid.EMDType,
		OpeningDate:      bid.OpeningDate,
		ClosingDate:      bid.ClosingDate,
		OEMRequired:               bid.OEMRequired,
		BidOwner:                  *owner,
		Remarks:                   bid.Remarks,
		Team:                      bid.Team,
		ScopeType:                 bid.ScopeType,
		BGRate:                    bid.BGRate,
		ActivityType:              bid.ActivityType,
		TargetMonthDate:           bid.TargetMonthDate,
		ExcelBidStatus:            bid.ExcelBidStatus,
		SubmissionStatus:          bid.SubmissionStatus,
		FinancialEvaluationStatus: bid.FinancialEvaluationStatus,
		POReceivedStatus:          bid.POReceivedStatus,
		EMDExempted:               bid.EMDExempted,
		HasTechEval:               bid.HasTechEval,
		BidResult:                 bid.BidResult,
		CreatedAt:                 bid.CreatedAt,
	}
}
