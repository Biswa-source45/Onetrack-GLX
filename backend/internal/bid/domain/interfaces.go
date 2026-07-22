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

	// Members
	AddMember(ctx context.Context, bidID string, userID string, role string, addedBy string) error
	RemoveMember(ctx context.Context, bidID string, userID string) error
	GetMembers(ctx context.Context, bidID string) ([]MemberResponse, error)

	// Stage history
	AddStageHistory(ctx context.Context, history *BidStageHistory) error
	GetStageHistory(ctx context.Context, bidID string) ([]BidStageHistory, error)

	// User lookup for response enrichment
	GetUserSummary(ctx context.Context, userID string) (*UserSummary, error)

	// Bid-scoped checklists
	BulkInsertChecklists(ctx context.Context, bidID string, titles []string) error
	GetChecklists(ctx context.Context, bidID string) ([]BidChecklist, error)
	AddChecklist(ctx context.Context, bidID string, title string, sortOrder int) (*BidChecklist, error)
	UpdateChecklist(ctx context.Context, checklistID string, title *string, sortOrder *int) error
	DeleteChecklist(ctx context.Context, checklistID string) error
	ReorderChecklists(ctx context.Context, items []ReorderChecklistItem) error
	ToggleChecklist(ctx context.Context, checklistID string, isDone bool, doneBy string) error
}

type BidService interface {
	CreateBid(ctx context.Context, req *CreateBidRequest, createdBy string) (*BidResponse, error)
	GetBid(ctx context.Context, id string) (*BidResponse, error)
	ListBids(ctx context.Context, params ListBidsParams) (*BidListResponse, error)
	UpdateBid(ctx context.Context, id string, req *UpdateBidRequest) error
	TransitionStage(ctx context.Context, id string, req *TransitionStageRequest, actorID string) (*TransitionResult, error)
	GetStageHistory(ctx context.Context, id string) ([]StageHistoryResponse, error)
	AddMember(ctx context.Context, bidID string, req *AddMemberRequest, actorID string) error
	RemoveMember(ctx context.Context, bidID string, userID string) error
	RecordOutcome(ctx context.Context, id string, req *RecordOutcomeRequest) error
	ArchiveBid(ctx context.Context, id string) error

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
