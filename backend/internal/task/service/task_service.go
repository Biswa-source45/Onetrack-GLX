package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/onetrack/backend/internal/task/domain"
)

type taskService struct {
	repo domain.TaskRepository
}

func NewTaskService(repo domain.TaskRepository) domain.TaskService {
	return &taskService{repo: repo}
}

func (s *taskService) CreateTask(ctx context.Context, bidID string, req *domain.CreateTaskRequest, createdBy string) (*domain.TaskResponse, error) {
	params, err := buildCreateParams(bidID, nil, req.TaskType, req.Title, req.Description,
		req.Priority, req.AssignedTo, createdBy, req.DueDate, req.SLADeadline,
		domain.SourceManual, nil, req.Metadata)
	if err != nil {
		return nil, err
	}

	id, err := s.repo.Create(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("create task: %w", err)
	}

	// Auto-log activity for assignment
	if req.AssignedTo != nil {
		data, _ := json.Marshal(map[string]string{"assigned_to": *req.AssignedTo})
		_, _ = s.repo.AddActivity(ctx, id, domain.ActivityAssigned, data, createdBy)
	}

	return s.GetTask(ctx, id)
}

func (s *taskService) CreateSubtask(ctx context.Context, parentTaskID string, req *domain.CreateSubtaskRequest, createdBy string) (*domain.TaskResponse, error) {
	parent, err := s.repo.GetByID(ctx, parentTaskID)
	if err != nil {
		return nil, fmt.Errorf("parent task not found: %w", err)
	}

	params, err := buildCreateParams(parent.BidID, &parentTaskID, domain.TypeGeneral, req.Title, req.Description,
		req.Priority, req.AssignedTo, createdBy, req.DueDate, nil,
		domain.SourceManual, nil, nil)
	if err != nil {
		return nil, err
	}

	id, err := s.repo.Create(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("create subtask: %w", err)
	}

	return s.GetTask(ctx, id)
}

func (s *taskService) GetTask(ctx context.Context, id string) (*domain.TaskResponse, error) {
	t, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.enrichTask(ctx, t)
}

func (s *taskService) ListTasks(ctx context.Context, params domain.ListTasksParams) (*domain.TaskListResponse, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 || params.Limit > 100 {
		params.Limit = 20
	}

	tasks, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, err
	}

	items := make([]domain.TaskResponse, 0, len(tasks))
	for _, t := range tasks {
		resp, err := s.enrichTask(ctx, &t)
		if err != nil {
			continue
		}
		items = append(items, *resp)
	}

	return &domain.TaskListResponse{
		Tasks:      items,
		Total:      total,
		Page:       params.Page,
		Limit:      params.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(params.Limit))),
	}, nil
}

func (s *taskService) UpdateTask(ctx context.Context, id string, req *domain.UpdateTaskRequest) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.Update(ctx, id, req)
}

func (s *taskService) UpdateStatus(ctx context.Context, id string, req *domain.UpdateTaskStatusRequest, actorID string) error {
	task, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if task.Status == domain.StatusCompleted || task.Status == domain.StatusCancelled {
		return fmt.Errorf("task is already %s", task.Status)
	}

	// Completion guards — enforce type-specific prerequisites
	if req.Status == domain.StatusCompleted && domain.IsGuardedType(task.TaskType) {
		var meta map[string]interface{}
		if len(task.Metadata) > 0 {
			_ = json.Unmarshal(task.Metadata, &meta)
		}
		switch task.TaskType {
		case domain.TypeApproval:
			decision, _ := meta["approval_decision"].(string)
			if decision == "" {
				return fmt.Errorf("approval task requires a recorded decision before completion")
			}
		case domain.TypeOEMCoordination:
			state, _ := meta["oem_state"].(string)
			if state != domain.OEMStateCompleted && state != domain.OEMStateRejected {
				return fmt.Errorf("OEM task must reach COMPLETED or REJECTED state before closing")
			}
		case domain.TypeDocumentCollection:
			uploaded, _ := meta["required_docs_uploaded"].(bool)
			if !uploaded {
				return fmt.Errorf("all required documents must be uploaded before completing this task")
			}
		}
	}

	prevStatus := task.Status
	if err := s.repo.UpdateStatus(ctx, id, req.Status); err != nil {
		return err
	}

	// Auto-log status change activity
	data, _ := json.Marshal(map[string]string{"from": prevStatus, "to": req.Status})
	_, _ = s.repo.AddActivity(ctx, id, domain.ActivityStatusChanged, data, actorID)

	return nil
}

func (s *taskService) AssignTask(ctx context.Context, id string, req *domain.AssignTaskRequest, actorID string) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if err := s.repo.UpdateAssignee(ctx, id, req.AssignedTo); err != nil {
		return err
	}

	data, _ := json.Marshal(map[string]string{"assigned_to": req.AssignedTo})
	_, _ = s.repo.AddActivity(ctx, id, domain.ActivityAssigned, data, actorID)

	return nil
}

func (s *taskService) DeleteTask(ctx context.Context, id string) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

func (s *taskService) GetSubtasks(ctx context.Context, parentID string) ([]domain.TaskResponse, error) {
	return s.getSubtasksDirect(ctx, parentID)
}

func (s *taskService) getSubtasksDirect(ctx context.Context, parentID string) ([]domain.TaskResponse, error) {
	// Re-use List with a workaround — we query subtasks by bid_id=parent's bid_id and parent_task_id=parentID
	parent, err := s.repo.GetByID(ctx, parentID)
	if err != nil {
		return nil, err
	}

	tasks, _, err := s.repo.List(ctx, domain.ListTasksParams{
		BidID: parent.BidID,
		Page:  1,
		Limit: 200,
	})
	if err != nil {
		return nil, err
	}

	var result []domain.TaskResponse
	for _, t := range tasks {
		if t.ParentTaskID != nil && *t.ParentTaskID == parentID {
			resp, _ := s.enrichTask(ctx, &t)
			if resp != nil {
				result = append(result, *resp)
			}
		}
	}
	if result == nil {
		result = []domain.TaskResponse{}
	}
	return result, nil
}

func (s *taskService) AddActivity(ctx context.Context, taskID string, req *domain.AddActivityRequest, performedBy string) (*domain.ActivityResponse, error) {
	_, err := s.repo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}

	data, err := json.Marshal(req.ActivityData)
	if err != nil {
		return nil, fmt.Errorf("marshal activity data: %w", err)
	}

	id, err := s.repo.AddActivity(ctx, taskID, req.ActivityType, data, performedBy)
	if err != nil {
		return nil, err
	}

	actor, _ := s.repo.GetUserSummary(ctx, performedBy)
	if actor == nil {
		actor = &domain.UserSummary{ID: performedBy}
	}

	var activityData interface{}
	_ = json.Unmarshal(data, &activityData)

	return &domain.ActivityResponse{
		ID:           id,
		TaskID:       taskID,
		ActivityType: req.ActivityType,
		ActivityData: activityData,
		PerformedBy:  *actor,
		CreatedAt:    time.Now().UTC(),
	}, nil
}

func (s *taskService) ListActivities(ctx context.Context, taskID string, params domain.ListActivitiesParams) (*domain.ActivityListResponse, error) {
	activities, total, err := s.repo.ListActivities(ctx, taskID, params)
	if err != nil {
		return nil, err
	}

	items := make([]domain.ActivityResponse, 0, len(activities))
	for _, a := range activities {
		actor, _ := s.repo.GetUserSummary(ctx, a.PerformedBy)
		if actor == nil {
			actor = &domain.UserSummary{ID: a.PerformedBy}
		}
		var data interface{}
		_ = json.Unmarshal(a.ActivityData, &data)

		items = append(items, domain.ActivityResponse{
			ID:           a.ID,
			TaskID:       a.TaskID,
			ActivityType: a.ActivityType,
			ActivityData: data,
			PerformedBy:  *actor,
			CreatedAt:    a.CreatedAt,
		})
	}

	return &domain.ActivityListResponse{
		Activities: items,
		Total:      total,
		Page:       params.Page,
		Limit:      params.Limit,
	}, nil
}

func (s *taskService) AddChecklist(ctx context.Context, taskID string, req *domain.AddChecklistRequest) (*domain.ChecklistResponse, error) {
	_, err := s.repo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	id, err := s.repo.AddChecklist(ctx, taskID, req.Title, sortOrder)
	if err != nil {
		return nil, err
	}

	return &domain.ChecklistResponse{
		ID:        id,
		TaskID:    taskID,
		Title:     req.Title,
		IsDone:    false,
		SortOrder: sortOrder,
		CreatedAt: time.Now().UTC(),
	}, nil
}

func (s *taskService) GetChecklists(ctx context.Context, taskID string) ([]domain.ChecklistResponse, error) {
	items, err := s.repo.GetChecklists(ctx, taskID)
	if err != nil {
		return nil, err
	}

	result := make([]domain.ChecklistResponse, 0, len(items))
	for _, item := range items {
		resp := domain.ChecklistResponse{
			ID:        item.ID,
			TaskID:    item.TaskID,
			Title:     item.Title,
			IsDone:    item.IsDone,
			DoneAt:    item.DoneAt,
			SortOrder: item.SortOrder,
			CreatedAt: item.CreatedAt,
		}
		if item.DoneBy != nil {
			u, _ := s.repo.GetUserSummary(ctx, *item.DoneBy)
			resp.DoneBy = u
		}
		result = append(result, resp)
	}
	return result, nil
}

func (s *taskService) UpdateChecklist(ctx context.Context, checklistID string, req *domain.UpdateChecklistRequest, actorID string) error {
	return s.repo.UpdateChecklist(ctx, checklistID, req.IsDone, actorID)
}

func (s *taskService) DeleteChecklist(ctx context.Context, checklistID string) error {
	return s.repo.DeleteChecklist(ctx, checklistID)
}

// ────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────

func (s *taskService) enrichTask(ctx context.Context, t *domain.Task) (*domain.TaskResponse, error) {
	resp := &domain.TaskResponse{
		ID:                   t.ID,
		BidID:                t.BidID,
		ParentTaskID:         t.ParentTaskID,
		TaskType:             t.TaskType,
		TaskCategory:         t.TaskCategory,
		Title:                t.Title,
		Description:          t.Description,
		Status:               t.Status,
		Priority:             t.Priority,
		DueDate:              t.DueDate,
		SLADeadline:          t.SLADeadline,
		CompletionPercentage: t.CompletionPercentage,
		Source:               t.Source,
		AIConfidence:         t.AIConfidence,
		CreatedAt:            t.CreatedAt,
		UpdatedAt:            t.UpdatedAt,
	}

	// Created by
	creator, _ := s.repo.GetUserSummary(ctx, t.CreatedBy)
	if creator == nil {
		creator = &domain.UserSummary{ID: t.CreatedBy}
	}
	resp.CreatedBy = *creator

	// Assigned to
	if t.AssignedTo != nil {
		assignee, _ := s.repo.GetUserSummary(ctx, *t.AssignedTo)
		resp.AssignedTo = assignee
	}

	// Metadata
	var meta interface{} = map[string]interface{}{}
	if len(t.Metadata) > 0 {
		_ = json.Unmarshal(t.Metadata, &meta)
	}
	resp.Metadata = meta

	// Counts
	resp.SubtaskCount, _ = s.repo.CountSubtasks(ctx, t.ID)
	resp.ChecklistCount, resp.ChecklistDoneCount, _ = s.repo.CountChecklists(ctx, t.ID)

	return resp, nil
}

// ────────────────────────────────────────
// My Tasks — cross-bid view
// ────────────────────────────────────────

func (s *taskService) ListMyTasks(ctx context.Context, params domain.MyTasksParams) (*domain.MyTasksResponse, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 || params.Limit > 100 {
		params.Limit = 20
	}

	tasks, total, err := s.repo.ListByAssignee(ctx, params)
	if err != nil {
		return nil, err
	}

	// Build a local bid-title cache to avoid N+1 — one DB call per unique bid_id
	bidTitleCache := make(map[string]string)

	items := make([]domain.TaskResponse, 0, len(tasks))
	for _, t := range tasks {
		resp, err := s.enrichTask(ctx, &t)
		if err != nil {
			continue
		}

		// Resolve bid title — hit cache first
		if title, ok := bidTitleCache[t.BidID]; ok {
			resp.BidTitle = title
		} else {
			title, err := s.repo.GetBidTitle(ctx, t.BidID)
			if err == nil {
				bidTitleCache[t.BidID] = title
				resp.BidTitle = title
			} else {
				bidTitleCache[t.BidID] = "" // don't retry failed lookups
			}
		}

		items = append(items, *resp)
	}

	return &domain.MyTasksResponse{
		Tasks:      items,
		Total:      total,
		Page:       params.Page,
		Limit:      params.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(params.Limit))),
	}, nil
}

// ────────────────────────────────────────
// Typed task creation
// ────────────────────────────────────────

func (s *taskService) CreateApprovalTask(ctx context.Context, bidID string, req *domain.CreateApprovalTaskRequest, createdBy string) (*domain.TaskResponse, error) {
	meta := domain.ApprovalTaskMetadata{
		ApproverID: req.ApproverID,
	}
	metaBytes, _ := json.Marshal(meta)
	metaStr := string(metaBytes)

	genericReq := &domain.CreateTaskRequest{
		TaskType:    domain.TypeApproval,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		AssignedTo:  &req.ApproverID,
		DueDate:     req.DueDate,
		SLADeadline: req.SLADeadline,
		Metadata:    &metaStr,
	}
	return s.CreateTask(ctx, bidID, genericReq, createdBy)
}

func (s *taskService) CreateOEMTask(ctx context.Context, bidID string, req *domain.CreateOEMTaskRequest, createdBy string) (*domain.TaskResponse, error) {
	meta := domain.OEMTaskMetadata{
		OEMName:       req.OEMName,
		ContactPerson: req.ContactPerson,
		ContactEmail:  req.ContactEmail,
		ContactPhone:  req.ContactPhone,
		MAFRequired:   req.MAFRequired,
		OEMState:      domain.OEMStateRequestInitiated,
	}
	metaBytes, _ := json.Marshal(meta)
	metaStr := string(metaBytes)

	genericReq := &domain.CreateTaskRequest{
		TaskType:    domain.TypeOEMCoordination,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		AssignedTo:  req.AssignedTo,
		DueDate:     req.DueDate,
		SLADeadline: req.SLADeadline,
		Metadata:    &metaStr,
	}
	return s.CreateTask(ctx, bidID, genericReq, createdBy)
}

func (s *taskService) CreateDocumentTask(ctx context.Context, bidID string, req *domain.CreateDocumentTaskRequest, createdBy string) (*domain.TaskResponse, error) {
	meta := domain.DocumentTaskMetadata{
		RequiredDocs:         req.RequiredDocs,
		UploadedDocs:         []string{},
		RequiredDocsUploaded: false,
	}
	metaBytes, _ := json.Marshal(meta)
	metaStr := string(metaBytes)

	genericReq := &domain.CreateTaskRequest{
		TaskType:    domain.TypeDocumentCollection,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		AssignedTo:  req.AssignedTo,
		DueDate:     req.DueDate,
		SLADeadline: req.SLADeadline,
		Metadata:    &metaStr,
	}
	return s.CreateTask(ctx, bidID, genericReq, createdBy)
}

// ────────────────────────────────────────
// APPROVAL task — submit decision
// ────────────────────────────────────────

func (s *taskService) SubmitApprovalDecision(ctx context.Context, taskID string, req *domain.SubmitApprovalDecisionRequest, actorID string) (*domain.TaskResponse, error) {
	task, err := s.repo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task.TaskType != domain.TypeApproval {
		return nil, fmt.Errorf("task is not an APPROVAL type")
	}
	validDecisions := map[string]bool{
		domain.ApprovalDecisionApprove: true,
		domain.ApprovalDecisionReject:  true,
		domain.ApprovalDecisionDefer:   true,
	}
	if !validDecisions[req.Decision] {
		return nil, fmt.Errorf("invalid decision: must be APPROVED, REJECTED, or DEFERRED")
	}

	// Load existing metadata and update decision fields
	var meta domain.ApprovalTaskMetadata
	if len(task.Metadata) > 0 {
		_ = json.Unmarshal(task.Metadata, &meta)
	}
	meta.ApprovalDecision = req.Decision
	meta.DecisionComment = req.Comment
	meta.DecisionAt = time.Now().UTC().Format(time.RFC3339)

	metaBytes, _ := json.Marshal(meta)
	if err := s.repo.UpdateMetadata(ctx, taskID, metaBytes); err != nil {
		return nil, fmt.Errorf("update approval metadata: %w", err)
	}

	// Auto-transition status to UNDER_REVIEW once a decision is recorded (if not already terminal)
	if task.Status != domain.StatusCompleted && task.Status != domain.StatusCancelled {
		_ = s.repo.UpdateStatus(ctx, taskID, domain.StatusUnderReview)
	}

	// Log activity
	activityType := domain.ActivityApprovalGranted
	if req.Decision == domain.ApprovalDecisionReject {
		activityType = domain.ActivityApprovalRejected
	}
	data, _ := json.Marshal(map[string]string{
		"decision": req.Decision,
		"comment":  req.Comment,
	})
	_, _ = s.repo.AddActivity(ctx, taskID, activityType, data, actorID)

	return s.GetTask(ctx, taskID)
}

// ────────────────────────────────────────
// OEM task — add follow-up
// ────────────────────────────────────────

func (s *taskService) AddOEMFollowUp(ctx context.Context, taskID string, req *domain.AddOEMFollowUpRequest, actorID string) (*domain.TaskResponse, error) {
	task, err := s.repo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task.TaskType != domain.TypeOEMCoordination {
		return nil, fmt.Errorf("task is not an OEM_COORDINATION type")
	}

	validStates := map[string]bool{
		domain.OEMStateRequestInitiated: true,
		domain.OEMStateFollowUpPending:  true,
		domain.OEMStateResponseReceived: true,
		domain.OEMStateDocumentPending:  true,
		domain.OEMStateCompleted:        true,
		domain.OEMStateRejected:         true,
		domain.OEMStateEscalated:        true,
	}
	if !validStates[req.NewOEMState] {
		return nil, fmt.Errorf("invalid oem_state: %s", req.NewOEMState)
	}

	// Load existing metadata and update OEM fields
	var meta domain.OEMTaskMetadata
	if len(task.Metadata) > 0 {
		_ = json.Unmarshal(task.Metadata, &meta)
	}
	meta.OEMState = req.NewOEMState
	meta.LastFollowUpAt = time.Now().UTC().Format(time.RFC3339)
	if req.ResponseStatus != "" {
		meta.ResponseStatus = req.ResponseStatus
	}

	metaBytes, _ := json.Marshal(meta)
	if err := s.repo.UpdateMetadata(ctx, taskID, metaBytes); err != nil {
		return nil, fmt.Errorf("update OEM metadata: %w", err)
	}

	// Auto-set task status based on OEM state
	newStatus := ""
	switch req.NewOEMState {
	case domain.OEMStateResponseReceived, domain.OEMStateDocumentPending:
		newStatus = domain.StatusInProgress
	case domain.OEMStateEscalated:
		newStatus = domain.StatusEscalated
	case domain.OEMStateCompleted, domain.OEMStateRejected:
		newStatus = domain.StatusUnderReview
	}
	if newStatus != "" && task.Status != domain.StatusCompleted {
		_ = s.repo.UpdateStatus(ctx, taskID, newStatus)
	}

	// Log follow-up activity
	data, _ := json.Marshal(map[string]string{
		"note":            req.Note,
		"oem_state":       req.NewOEMState,
		"response_status": req.ResponseStatus,
	})
	_, _ = s.repo.AddActivity(ctx, taskID, domain.ActivityOEMFollowUp, data, actorID)

	return s.GetTask(ctx, taskID)
}

func buildCreateParams(
	bidID string,
	parentTaskID *string,
	taskType string,
	title string,
	description *string,
	priority *string,
	assignedTo *string,
	createdBy string,
	dueDate *string,
	slaDeadline *string,
	source string,
	aiConfidence *float64,
	metadata *string,
) (*domain.CreateTaskParams, error) {
	p := &domain.CreateTaskParams{
		BidID:        bidID,
		ParentTaskID: parentTaskID,
		TaskType:     taskType,
		Title:        title,
		Description:  description,
		Priority:     domain.PriorityMedium,
		AssignedTo:   assignedTo,
		CreatedBy:    createdBy,
		Source:       source,
		AIConfidence: aiConfidence,
		Metadata:     []byte("{}"),
	}

	if priority != nil {
		p.Priority = *priority
	}
	if dueDate != nil {
		t, err := time.Parse(time.RFC3339, *dueDate)
		if err != nil {
			return nil, fmt.Errorf("invalid due_date format: %w", err)
		}
		p.DueDate = &t
	}
	if slaDeadline != nil {
		t, err := time.Parse(time.RFC3339, *slaDeadline)
		if err != nil {
			return nil, fmt.Errorf("invalid sla_deadline format: %w", err)
		}
		p.SLADeadline = &t
	}
	if metadata != nil {
		p.Metadata = []byte(*metadata)
	}

	return p, nil
}
