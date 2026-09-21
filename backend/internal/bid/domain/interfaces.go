package domain

import "context"

type BidRepository interface {
	Create(ctx context.Context, params *CreateBidParams) (string, error)
	GetByID(ctx context.Context, id string) (*BidWorkspace, error)
	// FindByIdentifier locates a live tender carrying the given GeM bid number
	// or RFP number. excludeID lets an update skip its own row.
	FindByIdentifier(ctx context.Context, identifier string, excludeID string) (*IdentifierMatch, error)
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

	// Stage history / Action Ledger. GetStageHistory and GetGlobalAuditLogs
	// both return fully user-resolved rows (no N+1 GetUserSummary calls from
	// the service layer) and page via AuditLogQuery's keyset cursor — each
	// returns (items, nextCursor, hasMore).
	AddStageHistory(ctx context.Context, history *BidStageHistory) error
	GetStageHistory(ctx context.Context, bidID string, q AuditLogQuery) ([]StageHistoryResponse, string, bool, error)
	// GetGlobalAuditLogs returns the audit feed, optionally scoped to one
	// actor (userID) for the per-person "Activity Log" view — empty userID
	// returns every actor's entries.
	GetGlobalAuditLogs(ctx context.Context, q AuditLogQuery, userID string) ([]GlobalAuditItem, string, bool, error)
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

	// Field Memory — non-AI autocomplete. entries maps a field key
	// ("organization_name", "oem", ...) to every raw value typed for it in
	// one save; RecordFieldSuggestions upserts each, deduped case/whitespace-
	// insensitively, incrementing usage_count on a repeat.
	RecordFieldSuggestions(ctx context.Context, entries map[string][]string) error
	ListFieldSuggestions(ctx context.Context, fieldKey string, limit int) ([]FieldSuggestion, error)

	// Stage-Level Access Control — see bid.user_stage_restrictions (migration
	// 000041). GetStageRestrictions returns the stage keys a user is
	// currently locked out of (empty = unrestricted); SetStageRestrictions
	// replaces the full set in one call.
	GetStageRestrictions(ctx context.Context, userID string) ([]string, error)
	SetStageRestrictions(ctx context.Context, userID string, stages []string, restrictedBy string) error

	// Tender edit approvals — see migration 000045. CreatePendingEdit fails
	// (unique index) if the bid already has a PENDING row.
	CreatePendingEdit(ctx context.Context, edit *TenderEditApproval) error
	GetPendingEditByID(ctx context.Context, editID string) (*TenderEditApproval, error)
	GetPendingEditForBid(ctx context.Context, bidID string) (*TenderEditApproval, error)
	DecidePendingEdit(ctx context.Context, editID string, status string, decidedPayload []byte, decisionDiff []FieldDiff, comment string, decidedBy string) error
}

type BidService interface {
	CreateBid(ctx context.Context, req *CreateBidRequest, createdBy string) (*BidResponse, error)
	GetBid(ctx context.Context, id string) (*BidResponse, error)
	ListBids(ctx context.Context, params ListBidsParams) (*BidListResponse, error)
	// actorRoles is the acting user's global roles (e.g. SUPER_ADMIN, ADMIN),
	// used only to authorize a Bid Owner reassignment when the actor isn't
	// this specific tender's Account Manager or Reporting Manager.
	UpdateBid(ctx context.Context, id string, req *UpdateBidRequest, actorID string, actorRoles []string) error
	TransitionStage(ctx context.Context, id string, req *TransitionStageRequest, actorID string) (*TransitionResult, error)
	GetStageHistory(ctx context.Context, id string, q AuditLogQuery) (*StageHistoryPage, error)
	AddMicroEvent(ctx context.Context, bidID string, req *AddMicroEventRequest, actorID string) (*StageHistoryResponse, error)
	// GetGlobalAuditLogs powers both the global "Database Audit Trail" panel
	// (userID empty) and the per-person "Activity Log" (userID set).
	GetGlobalAuditLogs(ctx context.Context, q AuditLogQuery, userID string) (*AuditLogPage, error)
	// GetTenderPerformanceMatrix returns per-owner stats, scoped to ownerID
	// when non-empty (used to restrict individual-contributor roles to their
	// own row) or every owner when empty (management roles).
	GetTenderPerformanceMatrix(ctx context.Context, ownerID string) ([]TenderOwnerPerformanceStat, error)
	AddMember(ctx context.Context, bidID string, req *AddMemberRequest, actorID string) error
	// RemoveMember blocks removing the Bid Owner or Account Manager (every
	// tender must always carry both — reassign via UpdateBid instead) and
	// nulls the matching FK when a Reporting Manager / Pre-Sales member is
	// removed, so the team panel and the tender's actual assignment can't
	// drift apart the way they used to.
	RemoveMember(ctx context.Context, bidID string, userID string, actorID string) error
	RecordOutcome(ctx context.Context, id string, req *RecordOutcomeRequest, actorID string) error
	ArchiveBid(ctx context.Context, id string, actorID string) error
	RestoreBid(ctx context.Context, id string, actorID string) error
	PermanentDeleteBid(ctx context.Context, id string, actorID string) error

	// Bid-scoped checklists
	GetChecklists(ctx context.Context, bidID string) ([]BidChecklistItem, error)
	AddChecklist(ctx context.Context, bidID string, req *AddChecklistRequest) (*BidChecklistItem, error)
	UpdateChecklist(ctx context.Context, bidID string, checklistID string, req *UpdateChecklistRequest) (*BidChecklistItem, error)
	DeleteChecklist(ctx context.Context, bidID string, checklistID string) error
	ReorderChecklists(ctx context.Context, bidID string, req *ReorderChecklistRequest) ([]BidChecklistItem, error)
	ToggleChecklist(ctx context.Context, bidID string, checklistID string, isDone bool, actorID string) (*BidChecklistItem, error)

	// ListFieldSuggestions returns the remembered values for one Field Memory
	// field key, ranked by usage. fieldKey is required.
	ListFieldSuggestions(ctx context.Context, fieldKey string) ([]FieldSuggestion, error)

	// GetStageRestrictions returns the workflow stages userID is currently
	// locked out of.
	GetStageRestrictions(ctx context.Context, userID string) ([]string, error)
	// SetStageRestrictions validates userID is a Bid Executive and every
	// stage key is real, replaces their restricted set, and records the
	// change to System Logs. actorID is who made the change.
	SetStageRestrictions(ctx context.Context, userID string, stages []string, actorID string) error

	// Tender edit approvals — a Bid Executive's Edit-Tender-form submission
	// held for Reporting Manager sign-off. GetPendingEdit is nil (no error)
	// when the tender has none open. finalReq on Approve is the Reporting
	// Manager's form state (defaults to the executive's own values, may
	// correct any of them); comment is optional on approve, and the reason
	// on reject.
	GetPendingEdit(ctx context.Context, bidID string) (*TenderEditApproval, error)
	ApprovePendingEdit(ctx context.Context, editID string, finalReq *UpdateBidRequest, comment string, actorID string, actorRoles []string) error
	RejectPendingEdit(ctx context.Context, editID string, comment string, actorID string, actorRoles []string) error
}

type TransitionResult struct {
	BidID          string `json:"bid_id"`
	PreviousStage  string `json:"previous_stage"`
	CurrentStage   string `json:"current_stage"`
	TransitionedAt string `json:"transitioned_at"`
}
