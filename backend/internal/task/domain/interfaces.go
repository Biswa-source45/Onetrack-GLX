package domain

import "context"

type TaskRepository interface {
	Create(ctx context.Context, params *CreateTaskParams) (string, error)
	GetByID(ctx context.Context, id string) (*Task, error)
	List(ctx context.Context, params ListTasksParams) ([]Task, int, error)
	Update(ctx context.Context, id string, req *UpdateTaskRequest) error
	UpdateStatus(ctx context.Context, id string, status string) error
	UpdateAssignee(ctx context.Context, id string, userID string) error
	UpdateMetadata(ctx context.Context, id string, metadata []byte) error
	Delete(ctx context.Context, id string) error

	// Cross-bid task list for assigned user
	ListByAssignee(ctx context.Context, params MyTasksParams) ([]Task, int, error)

	// Counts for response enrichment
	CountSubtasks(ctx context.Context, parentID string) (int, error)
	CountChecklists(ctx context.Context, taskID string) (int, int, error) // total, done

	// Activities
	AddActivity(ctx context.Context, taskID string, activityType string, data []byte, performedBy string) (string, error)
	ListActivities(ctx context.Context, taskID string, params ListActivitiesParams) ([]TaskActivity, int, error)

	// Checklists
	AddChecklist(ctx context.Context, taskID string, title string, sortOrder int) (string, error)
	GetChecklists(ctx context.Context, taskID string) ([]TaskChecklist, error)
	UpdateChecklist(ctx context.Context, id string, isDone bool, doneBy string) error
	DeleteChecklist(ctx context.Context, id string) error

	// User lookup
	GetUserSummary(ctx context.Context, userID string) (*UserSummary, error)

	// Bid title lookup — used to enrich my-tasks cross-bid view
	GetBidTitle(ctx context.Context, bidID string) (string, error)
}

type TaskService interface {
	// Generic task CRUD
	CreateTask(ctx context.Context, bidID string, req *CreateTaskRequest, createdBy string) (*TaskResponse, error)
	CreateSubtask(ctx context.Context, parentTaskID string, req *CreateSubtaskRequest, createdBy string) (*TaskResponse, error)
	GetTask(ctx context.Context, id string) (*TaskResponse, error)
	ListTasks(ctx context.Context, params ListTasksParams) (*TaskListResponse, error)
	UpdateTask(ctx context.Context, id string, req *UpdateTaskRequest) error
	UpdateStatus(ctx context.Context, id string, req *UpdateTaskStatusRequest, actorID string) error
	AssignTask(ctx context.Context, id string, req *AssignTaskRequest, actorID string) error
	DeleteTask(ctx context.Context, id string) error

	// My tasks — cross-bid view for the authenticated user
	ListMyTasks(ctx context.Context, params MyTasksParams) (*MyTasksResponse, error)

	// Typed task creation — each type produces the correct metadata blob at creation time
	CreateApprovalTask(ctx context.Context, bidID string, req *CreateApprovalTaskRequest, createdBy string) (*TaskResponse, error)
	CreateOEMTask(ctx context.Context, bidID string, req *CreateOEMTaskRequest, createdBy string) (*TaskResponse, error)
	CreateDocumentTask(ctx context.Context, bidID string, req *CreateDocumentTaskRequest, createdBy string) (*TaskResponse, error)

	// APPROVAL task actions
	SubmitApprovalDecision(ctx context.Context, taskID string, req *SubmitApprovalDecisionRequest, actorID string) (*TaskResponse, error)

	// OEM_COORDINATION task actions
	AddOEMFollowUp(ctx context.Context, taskID string, req *AddOEMFollowUpRequest, actorID string) (*TaskResponse, error)

	// Subtasks
	GetSubtasks(ctx context.Context, parentID string) ([]TaskResponse, error)

	// Activities
	AddActivity(ctx context.Context, taskID string, req *AddActivityRequest, performedBy string) (*ActivityResponse, error)
	ListActivities(ctx context.Context, taskID string, params ListActivitiesParams) (*ActivityListResponse, error)

	// Checklists
	AddChecklist(ctx context.Context, taskID string, req *AddChecklistRequest) (*ChecklistResponse, error)
	GetChecklists(ctx context.Context, taskID string) ([]ChecklistResponse, error)
	UpdateChecklist(ctx context.Context, checklistID string, req *UpdateChecklistRequest, actorID string) error
	DeleteChecklist(ctx context.Context, checklistID string) error
}
