package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/platform/response"
	"github.com/onetrack/backend/internal/task/domain"
)

type TaskHandler struct {
	svc domain.TaskService
}

func NewTaskHandler(svc domain.TaskService) *TaskHandler {
	return &TaskHandler{svc: svc}
}

// ────────────────────────────────────────
// Tasks under a bid: POST /bids/:id/tasks, GET /bids/:id/tasks
// ────────────────────────────────────────

func (h *TaskHandler) CreateTask(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}

	actorID := c.GetString("user_id")
	task, err := h.svc.CreateTask(c.Request.Context(), bidID, &req, actorID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Task created successfully", task)
}

func (h *TaskHandler) ListTasksForBid(c *gin.Context) {
	bidID := c.Param("id")

	parentOnly := false
	if c.Query("parent_only") == "true" {
		parentOnly = true
	}

	params := domain.ListTasksParams{
		BidID:      bidID,
		Status:     c.Query("status"),
		Priority:   c.Query("priority"),
		AssignedTo: c.Query("assigned_to"),
		TaskType:   c.Query("task_type"),
		ParentOnly: parentOnly,
		Page:       parseIntQuery(c, "page", 1),
		Limit:      parseIntQuery(c, "limit", 20),
	}

	result, err := h.svc.ListTasks(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result.Tasks,
		"meta": gin.H{
			"page":        result.Page,
			"limit":       result.Limit,
			"total":       result.Total,
			"total_pages": result.TotalPages,
		},
	})
}

// ────────────────────────────────────────
// Individual task: GET|PATCH|DELETE /tasks/:id
// ────────────────────────────────────────

func (h *TaskHandler) GetTask(c *gin.Context) {
	id := c.Param("id")
	task, err := h.svc.GetTask(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Task not found")
		return
	}
	response.Success(c, http.StatusOK, "Task retrieved", task)
}

func (h *TaskHandler) UpdateTask(c *gin.Context) {
	id := c.Param("id")
	var req domain.UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	if err := h.svc.UpdateTask(c.Request.Context(), id, &req); err != nil {
		response.NotFound(c, "Task not found")
		return
	}
	response.Success(c, http.StatusOK, "Task updated successfully", nil)
}

func (h *TaskHandler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var req domain.UpdateTaskStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	if err := h.svc.UpdateStatus(c.Request.Context(), id, &req, actorID); err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Task status updated", nil)
}

func (h *TaskHandler) AssignTask(c *gin.Context) {
	id := c.Param("id")
	var req domain.AssignTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	if err := h.svc.AssignTask(c.Request.Context(), id, &req, actorID); err != nil {
		response.NotFound(c, "Task not found")
		return
	}
	response.Success(c, http.StatusOK, "Task assigned successfully", nil)
}

func (h *TaskHandler) DeleteTask(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteTask(c.Request.Context(), id); err != nil {
		response.NotFound(c, "Task not found")
		return
	}
	response.Success(c, http.StatusOK, "Task cancelled", nil)
}

// ────────────────────────────────────────
// Subtasks: POST|GET /tasks/:id/subtasks
// ────────────────────────────────────────

func (h *TaskHandler) CreateSubtask(c *gin.Context) {
	parentID := c.Param("id")
	var req domain.CreateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	task, err := h.svc.CreateSubtask(c.Request.Context(), parentID, &req, actorID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Subtask created successfully", task)
}

func (h *TaskHandler) GetSubtasks(c *gin.Context) {
	parentID := c.Param("id")
	subtasks, err := h.svc.GetSubtasks(c.Request.Context(), parentID)
	if err != nil {
		response.NotFound(c, "Task not found")
		return
	}
	response.Success(c, http.StatusOK, "Subtasks retrieved", subtasks)
}

// ────────────────────────────────────────
// Activities: POST|GET /tasks/:id/activities
// ────────────────────────────────────────

func (h *TaskHandler) AddActivity(c *gin.Context) {
	taskID := c.Param("id")
	var req domain.AddActivityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	activity, err := h.svc.AddActivity(c.Request.Context(), taskID, &req, actorID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Activity logged", activity)
}

func (h *TaskHandler) ListActivities(c *gin.Context) {
	taskID := c.Param("id")
	params := domain.ListActivitiesParams{
		Page:  parseIntQuery(c, "page", 1),
		Limit: parseIntQuery(c, "limit", 50),
	}
	result, err := h.svc.ListActivities(c.Request.Context(), taskID, params)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result.Activities,
		"meta": gin.H{
			"page":  result.Page,
			"limit": result.Limit,
			"total": result.Total,
		},
	})
}

// ────────────────────────────────────────
// Checklists: POST|GET /tasks/:id/checklists
//             PATCH|DELETE /tasks/:id/checklists/:cid
// ────────────────────────────────────────

func (h *TaskHandler) AddChecklist(c *gin.Context) {
	taskID := c.Param("id")
	var req domain.AddChecklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	item, err := h.svc.AddChecklist(c.Request.Context(), taskID, &req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Checklist item added", item)
}

func (h *TaskHandler) GetChecklists(c *gin.Context) {
	taskID := c.Param("id")
	items, err := h.svc.GetChecklists(c.Request.Context(), taskID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklists retrieved", items)
}

func (h *TaskHandler) UpdateChecklist(c *gin.Context) {
	checklistID := c.Param("cid")
	var req domain.UpdateChecklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	if err := h.svc.UpdateChecklist(c.Request.Context(), checklistID, &req, actorID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklist item updated", nil)
}

func (h *TaskHandler) DeleteChecklist(c *gin.Context) {
	checklistID := c.Param("cid")
	if err := h.svc.DeleteChecklist(c.Request.Context(), checklistID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Checklist item removed", nil)
}

// ────────────────────────────────────────
// My Tasks: GET /me/tasks
// ────────────────────────────────────────

func (h *TaskHandler) MyTasks(c *gin.Context) {
	userID := c.GetString("user_id")

	overdue := false
	if c.Query("overdue") == "true" {
		overdue = true
	}

	params := domain.MyTasksParams{
		UserID:   userID,
		Status:   c.Query("status"),
		Priority: c.Query("priority"),
		TaskType: c.Query("task_type"),
		Overdue:  overdue,
		Page:     parseIntQuery(c, "page", 1),
		Limit:    parseIntQuery(c, "limit", 20),
	}

	result, err := h.svc.ListMyTasks(c.Request.Context(), params)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result.Tasks,
		"meta": gin.H{
			"page":        result.Page,
			"limit":       result.Limit,
			"total":       result.Total,
			"total_pages": result.TotalPages,
		},
	})
}

// ────────────────────────────────────────
// Typed task creation under a bid
// ────────────────────────────────────────

func (h *TaskHandler) CreateApprovalTask(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.CreateApprovalTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	task, err := h.svc.CreateApprovalTask(c.Request.Context(), bidID, &req, actorID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Approval task created", task)
}

func (h *TaskHandler) CreateOEMTask(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.CreateOEMTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	task, err := h.svc.CreateOEMTask(c.Request.Context(), bidID, &req, actorID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "OEM coordination task created", task)
}

func (h *TaskHandler) CreateDocumentTask(c *gin.Context) {
	bidID := c.Param("id")
	var req domain.CreateDocumentTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	task, err := h.svc.CreateDocumentTask(c.Request.Context(), bidID, &req, actorID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, "Document collection task created", task)
}

// ────────────────────────────────────────
// APPROVAL task: POST /tasks/:id/approve
// ────────────────────────────────────────

func (h *TaskHandler) SubmitApprovalDecision(c *gin.Context) {
	taskID := c.Param("id")
	var req domain.SubmitApprovalDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	task, err := h.svc.SubmitApprovalDecision(c.Request.Context(), taskID, &req, actorID)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Approval decision recorded", task)
}

// ────────────────────────────────────────
// OEM task: POST /tasks/:id/oem-followup
// ────────────────────────────────────────

func (h *TaskHandler) AddOEMFollowUp(c *gin.Context) {
	taskID := c.Param("id")
	var req domain.AddOEMFollowUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	actorID := c.GetString("user_id")
	task, err := h.svc.AddOEMFollowUp(c.Request.Context(), taskID, &req, actorID)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "OEM follow-up recorded", task)
}

func parseIntQuery(c *gin.Context, key string, def int) int {
	v := c.Query(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return def
	}
	return n
}
