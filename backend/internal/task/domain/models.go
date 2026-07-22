package domain

import "time"

// ────────────────────────────────────────
// OEM coordination lifecycle states
// ────────────────────────────────────────

const (
	OEMStateRequestInitiated = "REQUEST_INITIATED"
	OEMStateFollowUpPending  = "FOLLOW_UP_PENDING"
	OEMStateResponseReceived = "RESPONSE_RECEIVED"
	OEMStateDocumentPending  = "DOCUMENT_PENDING"
	OEMStateCompleted        = "COMPLETED"
	OEMStateRejected         = "REJECTED"
	OEMStateEscalated        = "ESCALATED"
)

// OEM follow-up activity sub-type
const (
	ActivityOEMFollowUp      = "OEM_FOLLOW_UP"
	ActivityApprovalGranted  = "APPROVAL_GRANTED"
	ActivityApprovalRejected = "APPROVAL_REJECTED"
)

// Approval decision values
const (
	ApprovalDecisionApprove = "APPROVED"
	ApprovalDecisionReject  = "REJECTED"
	ApprovalDecisionDefer   = "DEFERRED"
)

// completionGuards defines which task types require guard conditions before
// transitioning to COMPLETED. The service layer enforces these rules.
//
// APPROVAL   → requires a recorded approval decision (metadata.approval_decision != "")
// OEM_COORD  → requires oem_state == COMPLETED or REJECTED
// DOCUMENT   → requires metadata.required_docs_uploaded == true (set by upload handler)
var completionGuards = map[string]bool{
	TypeApproval:           true,
	TypeOEMCoordination:    true,
	TypeDocumentCollection: true,
}

// IsGuardedType returns true if the given task type has completion guard rules.
func IsGuardedType(taskType string) bool {
	return completionGuards[taskType]
}

// Task status values — shared by manual and AI-generated tasks
const (
	StatusOpen            = "OPEN"
	StatusAssigned        = "ASSIGNED"
	StatusInProgress      = "IN_PROGRESS"
	StatusWaitingExternal = "WAITING_EXTERNAL"
	StatusBlocked         = "BLOCKED"
	StatusUnderReview     = "UNDER_REVIEW"
	StatusCompleted       = "COMPLETED"
	StatusCancelled       = "CANCELLED"
	StatusEscalated       = "ESCALATED"
	StatusReopened        = "REOPENED"
)

// Task priority values
const (
	PriorityLow      = "LOW"
	PriorityMedium   = "MEDIUM"
	PriorityHigh     = "HIGH"
	PriorityCritical = "CRITICAL"
)

// Task types
const (
	TypeGeneral            = "GENERAL"
	TypeDocumentCollection = "DOCUMENT_COLLECTION"
	TypeOEMCoordination    = "OEM_COORDINATION"
	TypeQualification      = "QUALIFICATION"
	TypeCommercial         = "COMMERCIAL"
	TypeApproval           = "APPROVAL"
	TypeReview             = "REVIEW"
	TypeSubmission         = "SUBMISSION"
	TypeChecklist          = "CHECKLIST"
	TypeCustom             = "CUSTOM"
	TypeAIGenerated        = "AI_GENERATED" // Used by intelligence mode
)

// Task source
const (
	SourceManual      = "MANUAL"
	SourceAIGenerated = "AI_GENERATED"
	SourceTemplate    = "TEMPLATE"
)

// Activity types
const (
	ActivityComment         = "COMMENT"
	ActivityStatusChanged   = "STATUS_CHANGED"
	ActivityAssigned        = "ASSIGNED"
	ActivityAttachmentAdded = "ATTACHMENT_ADDED"
	ActivityCallLogged      = "CALL_LOGGED"
	ActivityEmailLogged     = "EMAIL_LOGGED"
	ActivityEscalated       = "ESCALATED"
	ActivityDeadlineChanged = "DEADLINE_CHANGED"
)

// ────────────────────────────────────────
// Core entities
// ────────────────────────────────────────

type Task struct {
	ID                   string     `json:"id"`
	BidID                string     `json:"bid_id"`
	ParentTaskID         *string    `json:"parent_task_id,omitempty"`
	TaskType             string     `json:"task_type"`
	TaskCategory         *string    `json:"task_category,omitempty"`
	Title                string     `json:"title"`
	Description          *string    `json:"description,omitempty"`
	Status               string     `json:"status"`
	Priority             string     `json:"priority"`
	AssignedTo           *string    `json:"assigned_to,omitempty"`
	CreatedBy            string     `json:"created_by"`
	DueDate              *time.Time `json:"due_date,omitempty"`
	SLADeadline          *time.Time `json:"sla_deadline,omitempty"`
	CompletionPercentage float64    `json:"completion_percentage"`
	Source               string     `json:"source"`
	AIConfidence         *float64   `json:"ai_confidence,omitempty"`
	Metadata             []byte     `json:"-"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type TaskActivity struct {
	ID           string    `json:"id"`
	TaskID       string    `json:"task_id"`
	ActivityType string    `json:"activity_type"`
	ActivityData []byte    `json:"-"`
	PerformedBy  string    `json:"performed_by"`
	CreatedAt    time.Time `json:"created_at"`
}

type TaskChecklist struct {
	ID        string     `json:"id"`
	TaskID    string     `json:"task_id"`
	Title     string     `json:"title"`
	IsDone    bool       `json:"is_done"`
	DoneBy    *string    `json:"done_by,omitempty"`
	DoneAt    *time.Time `json:"done_at,omitempty"`
	SortOrder int        `json:"sort_order"`
	CreatedAt time.Time  `json:"created_at"`
}

// ────────────────────────────────────────
// Request DTOs
// ────────────────────────────────────────

type CreateTaskRequest struct {
	TaskType    string  `json:"task_type" binding:"required"`
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	Priority    *string `json:"priority"`
	AssignedTo  *string `json:"assigned_to"`
	DueDate     *string `json:"due_date"`
	SLADeadline *string `json:"sla_deadline"`
	Metadata    *string `json:"metadata"`
}

type CreateSubtaskRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	Priority    *string `json:"priority"`
	AssignedTo  *string `json:"assigned_to"`
	DueDate     *string `json:"due_date"`
}

type UpdateTaskRequest struct {
	Title                *string  `json:"title"`
	Description          *string  `json:"description"`
	Priority             *string  `json:"priority"`
	DueDate              *string  `json:"due_date"`
	SLADeadline          *string  `json:"sla_deadline"`
	CompletionPercentage *float64 `json:"completion_percentage"`
}

type UpdateTaskStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type AssignTaskRequest struct {
	AssignedTo string `json:"assigned_to" binding:"required"`
}

type AddActivityRequest struct {
	ActivityType string                 `json:"activity_type" binding:"required"`
	ActivityData map[string]interface{} `json:"activity_data" binding:"required"`
}

type AddChecklistRequest struct {
	Title     string `json:"title" binding:"required"`
	SortOrder *int   `json:"sort_order"`
}

type UpdateChecklistRequest struct {
	IsDone bool `json:"is_done"`
}

// ────────────────────────────────────────
// Response DTOs
// ────────────────────────────────────────

type UserSummary struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
}

type TaskResponse struct {
	ID                   string       `json:"id"`
	BidID                string       `json:"bid_id"`
	BidTitle             string       `json:"bid_title,omitempty"`
	ParentTaskID         *string      `json:"parent_task_id"`
	TaskType             string       `json:"task_type"`
	TaskCategory         *string      `json:"task_category"`
	Title                string       `json:"title"`
	Description          *string      `json:"description"`
	Status               string       `json:"status"`
	Priority             string       `json:"priority"`
	AssignedTo           *UserSummary `json:"assigned_to"`
	CreatedBy            UserSummary  `json:"created_by"`
	DueDate              *time.Time   `json:"due_date"`
	SLADeadline          *time.Time   `json:"sla_deadline"`
	CompletionPercentage float64      `json:"completion_percentage"`
	Source               string       `json:"source"`
	AIConfidence         *float64     `json:"ai_confidence,omitempty"`
	Metadata             interface{}  `json:"metadata"`
	SubtaskCount         int          `json:"subtask_count"`
	ChecklistCount       int          `json:"checklist_count"`
	ChecklistDoneCount   int          `json:"checklist_done_count"`
	CreatedAt            time.Time    `json:"created_at"`
	UpdatedAt            time.Time    `json:"updated_at"`
}

type ActivityResponse struct {
	ID           string      `json:"id"`
	TaskID       string      `json:"task_id"`
	ActivityType string      `json:"activity_type"`
	ActivityData interface{} `json:"activity_data"`
	PerformedBy  UserSummary `json:"performed_by"`
	CreatedAt    time.Time   `json:"created_at"`
}

type ChecklistResponse struct {
	ID        string       `json:"id"`
	TaskID    string       `json:"task_id"`
	Title     string       `json:"title"`
	IsDone    bool         `json:"is_done"`
	DoneBy    *UserSummary `json:"done_by,omitempty"`
	DoneAt    *time.Time   `json:"done_at,omitempty"`
	SortOrder int          `json:"sort_order"`
	CreatedAt time.Time    `json:"created_at"`
}

type TaskListResponse struct {
	Tasks      []TaskResponse `json:"tasks"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	TotalPages int            `json:"total_pages"`
}

type ActivityListResponse struct {
	Activities []ActivityResponse `json:"activities"`
	Total      int                `json:"total"`
	Page       int                `json:"page"`
	Limit      int                `json:"limit"`
}

// ────────────────────────────────────────
// Query params
// ────────────────────────────────────────

type ListTasksParams struct {
	BidID      string
	Status     string
	Priority   string
	AssignedTo string
	TaskType   string
	ParentOnly bool
	Page       int
	Limit      int
}

type ListActivitiesParams struct {
	Page  int
	Limit int
}

// ────────────────────────────────────────
// Repository-level insert types
// ────────────────────────────────────────

type CreateTaskParams struct {
	BidID        string
	ParentTaskID *string
	TaskType     string
	Title        string
	Description  *string
	Priority     string
	AssignedTo   *string
	CreatedBy    string
	DueDate      *time.Time
	SLADeadline  *time.Time
	Source       string
	AIConfidence *float64
	Metadata     []byte
}

// ────────────────────────────────────────
// My Tasks (cross-bid view for assigned user)
// ────────────────────────────────────────

type MyTasksParams struct {
	UserID   string
	Status   string
	Priority string
	TaskType string
	Overdue  bool
	Page     int
	Limit    int
}

type MyTasksResponse struct {
	Tasks      []TaskResponse `json:"tasks"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	TotalPages int            `json:"total_pages"`
}

// ────────────────────────────────────────
// APPROVAL task typed metadata + action
// ────────────────────────────────────────

// ApprovalTaskMetadata is stored in task.metadata JSONB for APPROVAL type tasks.
type ApprovalTaskMetadata struct {
	ApproverID       string `json:"approver_id"`
	ApprovalDecision string `json:"approval_decision"` // APPROVED | REJECTED | DEFERRED
	DecisionComment  string `json:"decision_comment"`
	DecisionAt       string `json:"decision_at"`
}

type CreateApprovalTaskRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	ApproverID  string  `json:"approver_id" binding:"required"`
	Priority    *string `json:"priority"`
	DueDate     *string `json:"due_date"`
	SLADeadline *string `json:"sla_deadline"`
}

type SubmitApprovalDecisionRequest struct {
	Decision string `json:"decision" binding:"required"` // APPROVED | REJECTED | DEFERRED
	Comment  string `json:"comment"`
}

// ────────────────────────────────────────
// OEM_COORDINATION task typed metadata + action
// ────────────────────────────────────────

// OEMTaskMetadata is stored in task.metadata JSONB for OEM_COORDINATION type tasks.
type OEMTaskMetadata struct {
	OEMName        string `json:"oem_name"`
	ContactPerson  string `json:"contact_person"`
	ContactEmail   string `json:"contact_email,omitempty"`
	ContactPhone   string `json:"contact_phone,omitempty"`
	MAFRequired    bool   `json:"maf_required"`
	OEMState       string `json:"oem_state"`
	LastFollowUpAt string `json:"last_follow_up_at,omitempty"`
	ResponseStatus string `json:"response_status,omitempty"`
}

type CreateOEMTaskRequest struct {
	Title         string  `json:"title" binding:"required"`
	Description   *string `json:"description"`
	OEMName       string  `json:"oem_name" binding:"required"`
	ContactPerson string  `json:"contact_person" binding:"required"`
	ContactEmail  string  `json:"contact_email"`
	ContactPhone  string  `json:"contact_phone"`
	MAFRequired   bool    `json:"maf_required"`
	Priority      *string `json:"priority"`
	DueDate       *string `json:"due_date"`
	SLADeadline   *string `json:"sla_deadline"`
	AssignedTo    *string `json:"assigned_to"`
}

type AddOEMFollowUpRequest struct {
	Note           string `json:"note" binding:"required"`
	NewOEMState    string `json:"new_oem_state" binding:"required"` // see OEMState* constants
	ResponseStatus string `json:"response_status"`
}

// ────────────────────────────────────────
// DOCUMENT_COLLECTION task typed metadata
// ────────────────────────────────────────

// DocumentTaskMetadata is stored in task.metadata JSONB for DOCUMENT_COLLECTION tasks.
type DocumentTaskMetadata struct {
	RequiredDocs         []string `json:"required_docs"`
	UploadedDocs         []string `json:"uploaded_docs"`
	RequiredDocsUploaded bool     `json:"required_docs_uploaded"`
}

type CreateDocumentTaskRequest struct {
	Title        string   `json:"title" binding:"required"`
	Description  *string  `json:"description"`
	RequiredDocs []string `json:"required_docs"`
	Priority     *string  `json:"priority"`
	AssignedTo   *string  `json:"assigned_to"`
	DueDate      *string  `json:"due_date"`
	SLADeadline  *string  `json:"sla_deadline"`
}

// ────────────────────────────────────────
// Generic metadata update
// ────────────────────────────────────────

type UpdateTaskMetadataRequest struct {
	Metadata map[string]interface{} `json:"metadata" binding:"required"`
}
