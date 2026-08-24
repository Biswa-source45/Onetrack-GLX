package domain

import "context"

type BidRepository interface {
	Create(ctx context.Context, params *CreateBidParams) (string, error)
	GetByID(ctx context.Context, id string) (*BidWorkspace, error)
	List(ctx context.Context, params ListBidsParams) ([]BidWorkspace, int, map[string]int, error)
	Update(ctx context.Context, id string, req *UpdateBidRequest) error
	UpdateStage(ctx context.Context, id string, stage string, status string) error
	UpdateOutcome(ctx context.Context, id string, req *RecordOutcomeRequest) error
	SoftDelete(ctx context.Context, id string) error
	Restore(ctx context.Context, id string) error
	PermanentDelete(ctx context.Context, id string) error
	CleanupExpired(ctx context.Context) error

	// Members
	AddMember(ctx context.Context, bidID string, userID string, role string, addedBy string) error
	RemoveMember(ctx context.Context, bidID string, userID string) error
	GetMembers(ctx context.Context, bidID string) ([]MemberResponse, error)

	// Stage history
	AddStageHistory(ctx context.Context, history *BidStageHistory) error
	GetStageHistory(ctx context.Context, bidID string) ([]BidStageHistory, error)
	GetGlobalAuditLogs(ctx context.Context, limit int) ([]GlobalAuditItem, error)
	// GetTenderPerformanceMatrix returns per-owner stats. ownerID scopes the
	// result to a single owner when non-empty; empty returns every owner.
	GetTenderPerformanceMatrix(ctx context.Context, ownerID string) ([]TenderOwnerPerformanceStat, error)

	// User lookup for response enrichment
	GetUserSummary(ctx context.Context, userID string) (*UserSummary, error)
	BulkInsertChecklists(ctx context.Context, bidID string, titles []string) error
	BulkInsertChecklistsWithGroup(ctx context.Context, bidID string, titles []string, group string) error
	GetChecklists(ctx context.Context, bidID string) ([]BidChecklist, error)
	GetChecklistsByGroup(ctx context.Context, bidID string, group string) ([]BidChecklist, error)
	AddChecklist(ctx context.Context, bidID string, title string, sortOrder int) (*BidChecklist, error)
	AddChecklistWithGroup(ctx context.Context, bidID string, title string, sortOrder int, group string) (*BidChecklist, error)
	UpdateChecklist(ctx context.Context, checklistID string, title *string, sortOrder *int) error
	DeleteChecklist(ctx context.Context, checklistID string) error
	ReorderChecklists(ctx context.Context, items []ReorderChecklistItem) error
	ToggleChecklist(ctx context.Context, checklistID string, isDone bool, doneBy string) error
}

type BidService interface {
	CreateBid(ctx context.Context, req *CreateBidRequest, createdBy string) (*BidResponse, error)
	GetBid(ctx context.Context, id string) (*BidResponse, error)
	ListBids(ctx context.Context, params ListBidsParams) (*BidListResponse, error)
	UpdateBid(ctx context.Context, id string, req *UpdateBidRequest, actorID string) error
	TransitionStage(ctx context.Context, id string, req *TransitionStageRequest, actorID string) (*TransitionResult, error)
	GetStageHistory(ctx context.Context, id string) ([]StageHistoryResponse, error)
	AddMicroEvent(ctx context.Context, bidID string, req *AddMicroEventRequest, actorID string) (*StageHistoryResponse, error)
	GetGlobalAuditLogs(ctx context.Context, limit int) ([]GlobalAuditItem, error)
	// GetTenderPerformanceMatrix returns per-owner stats, scoped to ownerID
	// when non-empty (used to restrict individual-contributor roles to their
	// own row) or every owner when empty (management roles).
	GetTenderPerformanceMatrix(ctx context.Context, ownerID string) ([]TenderOwnerPerformanceStat, error)
	AddMember(ctx context.Context, bidID string, req *AddMemberRequest, actorID string) error
	RemoveMember(ctx context.Context, bidID string, userID string) error
	RecordOutcome(ctx context.Context, id string, req *RecordOutcomeRequest) error
	ArchiveBid(ctx context.Context, id string) error
	RestoreBid(ctx context.Context, id string) error
	PermanentDeleteBid(ctx context.Context, id string) error

	// Bid-scoped checklists
	GetChecklists(ctx context.Context, bidID string) ([]BidChecklistItem, error)
	AddChecklist(ctx context.Context, bidID string, req *AddChecklistRequest) (*BidChecklistItem, error)
	UpdateChecklist(ctx context.Context, bidID string, checklistID string, req *UpdateChecklistRequest) (*BidChecklistItem, error)
	DeleteChecklist(ctx context.Context, bidID string, checklistID string) error
	ReorderChecklists(ctx context.Context, bidID string, req *ReorderChecklistRequest) ([]BidChecklistItem, error)
	ToggleChecklist(ctx context.Context, bidID string, checklistID string, isDone bool, actorID string) (*BidChecklistItem, error)
}

type TransitionResult struct {
	BidID          string `json:"bid_id"`
	PreviousStage  string `json:"previous_stage"`
	CurrentStage   string `json:"current_stage"`
	TransitionedAt string `json:"transitioned_at"`
}
