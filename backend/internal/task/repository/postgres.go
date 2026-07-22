package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/task/domain"
)

type postgresTaskRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresTaskRepository(pool *pgxpool.Pool) domain.TaskRepository {
	return &postgresTaskRepo{pool: pool}
}

func (r *postgresTaskRepo) Create(ctx context.Context, params *domain.CreateTaskParams) (string, error) {
	query := `
		INSERT INTO task.tasks (
			bid_id, parent_task_id, task_type, title, description,
			status, priority, assigned_to, created_by,
			due_date, sla_deadline, source, ai_confidence, metadata
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12, $13, $14
		) RETURNING id
	`
	status := domain.StatusOpen
	if params.AssignedTo != nil {
		status = domain.StatusAssigned
	}

	var id string
	err := r.pool.QueryRow(ctx, query,
		params.BidID, params.ParentTaskID, params.TaskType, params.Title, params.Description,
		status, params.Priority, params.AssignedTo, params.CreatedBy,
		params.DueDate, params.SLADeadline, params.Source, params.AIConfidence, params.Metadata,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create task: %w", err)
	}
	return id, nil
}

func (r *postgresTaskRepo) GetByID(ctx context.Context, id string) (*domain.Task, error) {
	query := `
		SELECT id, bid_id, parent_task_id, task_type, task_category, title, description,
		       status, priority, assigned_to, created_by,
		       due_date, sla_deadline, completion_percentage,
		       source, ai_confidence, metadata,
		       created_at, updated_at
		FROM task.tasks
		WHERE id = $1 AND status != 'CANCELLED'
	`
	row := r.pool.QueryRow(ctx, query, id)
	return scanTask(row)
}

func (r *postgresTaskRepo) List(ctx context.Context, params domain.ListTasksParams) ([]domain.Task, int, error) {
	conditions := []string{"t.bid_id = $1"}
	args := []interface{}{params.BidID}
	idx := 2

	if params.ParentOnly {
		conditions = append(conditions, "t.parent_task_id IS NULL")
	}
	if params.Status != "" {
		conditions = append(conditions, fmt.Sprintf("t.status = $%d", idx))
		args = append(args, params.Status)
		idx++
	}
	if params.Priority != "" {
		conditions = append(conditions, fmt.Sprintf("t.priority = $%d", idx))
		args = append(args, params.Priority)
		idx++
	}
	if params.AssignedTo != "" {
		conditions = append(conditions, fmt.Sprintf("t.assigned_to = $%d", idx))
		args = append(args, params.AssignedTo)
		idx++
	}
	if params.TaskType != "" {
		conditions = append(conditions, fmt.Sprintf("t.task_type = $%d", idx))
		args = append(args, params.TaskType)
		idx++
	}

	// Exclude cancelled tasks in list view
	conditions = append(conditions, "t.status != 'CANCELLED'")

	where := "WHERE " + strings.Join(conditions, " AND ")

	var total int
	if err := r.pool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM task.tasks t %s", where), args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count tasks: %w", err)
	}

	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 20
	}
	offset := (params.Page - 1) * params.Limit

	listArgs := append(args, params.Limit, offset)
	query := fmt.Sprintf(`
		SELECT id, bid_id, parent_task_id, task_type, task_category, title, description,
		       status, priority, assigned_to, created_by,
		       due_date, sla_deadline, completion_percentage,
		       source, ai_confidence, metadata,
		       created_at, updated_at
		FROM task.tasks t
		%s
		ORDER BY
		  CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
		  created_at ASC
		LIMIT $%d OFFSET $%d
	`, where, idx, idx+1)

	rows, err := r.pool.Query(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	var tasks []domain.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, 0, err
		}
		tasks = append(tasks, *t)
	}
	if tasks == nil {
		tasks = []domain.Task{}
	}
	return tasks, total, nil
}

func (r *postgresTaskRepo) Update(ctx context.Context, id string, req *domain.UpdateTaskRequest) error {
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
	if req.Description != nil {
		addSet("description", *req.Description)
	}
	if req.Priority != nil {
		addSet("priority", *req.Priority)
	}
	if req.DueDate != nil {
		t, err := time.Parse(time.RFC3339, *req.DueDate)
		if err == nil {
			addSet("due_date", t)
		}
	}
	if req.SLADeadline != nil {
		t, err := time.Parse(time.RFC3339, *req.SLADeadline)
		if err == nil {
			addSet("sla_deadline", t)
		}
	}
	if req.CompletionPercentage != nil {
		addSet("completion_percentage", *req.CompletionPercentage)
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE task.tasks SET %s WHERE id = $%d", strings.Join(sets, ", "), idx)
	_, err := r.pool.Exec(ctx, query, args...)
	return err
}

func (r *postgresTaskRepo) UpdateStatus(ctx context.Context, id string, status string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE task.tasks SET status = $1, updated_at = NOW() WHERE id = $2",
		status, id,
	)
	return err
}

func (r *postgresTaskRepo) UpdateAssignee(ctx context.Context, id string, userID string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE task.tasks SET assigned_to = $1, status = 'ASSIGNED', updated_at = NOW() WHERE id = $2",
		userID, id,
	)
	return err
}

func (r *postgresTaskRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE task.tasks SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1",
		id,
	)
	return err
}

func (r *postgresTaskRepo) UpdateMetadata(ctx context.Context, id string, metadata []byte) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE task.tasks SET metadata = $1, updated_at = NOW() WHERE id = $2",
		metadata, id,
	)
	return err
}

func (r *postgresTaskRepo) ListByAssignee(ctx context.Context, params domain.MyTasksParams) ([]domain.Task, int, error) {
	conditions := []string{"t.assigned_to = $1", "t.status != 'CANCELLED'"}
	args := []interface{}{params.UserID}
	idx := 2

	if params.Status != "" {
		conditions = append(conditions, fmt.Sprintf("t.status = $%d", idx))
		args = append(args, params.Status)
		idx++
	}
	if params.Priority != "" {
		conditions = append(conditions, fmt.Sprintf("t.priority = $%d", idx))
		args = append(args, params.Priority)
		idx++
	}
	if params.TaskType != "" {
		conditions = append(conditions, fmt.Sprintf("t.task_type = $%d", idx))
		args = append(args, params.TaskType)
		idx++
	}
	if params.Overdue {
		conditions = append(conditions, "t.due_date < NOW()")
		conditions = append(conditions, "t.status NOT IN ('COMPLETED','CANCELLED')")
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	var total int
	if err := r.pool.QueryRow(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM task.tasks t %s", where), args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count my tasks: %w", err)
	}

	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 20
	}
	offset := (params.Page - 1) * params.Limit
	listArgs := append(args, params.Limit, offset)

	query := fmt.Sprintf(`
		SELECT id, bid_id, parent_task_id, task_type, task_category, title, description,
		       status, priority, assigned_to, created_by,
		       due_date, sla_deadline, completion_percentage,
		       source, ai_confidence, metadata,
		       created_at, updated_at
		FROM task.tasks t
		%s
		ORDER BY
		  CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
		  due_date ASC NULLS LAST,
		  created_at ASC
		LIMIT $%d OFFSET $%d
	`, where, idx, idx+1)

	rows, err := r.pool.Query(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list my tasks: %w", err)
	}
	defer rows.Close()

	var tasks []domain.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, 0, err
		}
		tasks = append(tasks, *t)
	}
	if tasks == nil {
		tasks = []domain.Task{}
	}
	return tasks, total, nil
}

func (r *postgresTaskRepo) CountSubtasks(ctx context.Context, parentID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM task.tasks WHERE parent_task_id = $1 AND status != 'CANCELLED'",
		parentID,
	).Scan(&count)
	return count, err
}

func (r *postgresTaskRepo) CountChecklists(ctx context.Context, taskID string) (int, int, error) {
	var total, done int
	err := r.pool.QueryRow(ctx,
		"SELECT COUNT(*), COUNT(*) FILTER (WHERE is_done = true) FROM task.task_checklists WHERE task_id = $1",
		taskID,
	).Scan(&total, &done)
	return total, done, err
}

func (r *postgresTaskRepo) AddActivity(ctx context.Context, taskID string, activityType string, data []byte, performedBy string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx,
		`INSERT INTO task.task_activities (task_id, activity_type, activity_data, performed_by)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		taskID, activityType, data, performedBy,
	).Scan(&id)
	return id, err
}

func (r *postgresTaskRepo) ListActivities(ctx context.Context, taskID string, params domain.ListActivitiesParams) ([]domain.TaskActivity, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM task.task_activities WHERE task_id = $1", taskID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 50
	}
	offset := (params.Page - 1) * params.Limit

	rows, err := r.pool.Query(ctx, `
		SELECT id, task_id, activity_type, activity_data, performed_by, created_at
		FROM task.task_activities
		WHERE task_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, taskID, params.Limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var activities []domain.TaskActivity
	for rows.Next() {
		var a domain.TaskActivity
		if err := rows.Scan(&a.ID, &a.TaskID, &a.ActivityType, &a.ActivityData, &a.PerformedBy, &a.CreatedAt); err != nil {
			return nil, 0, err
		}
		activities = append(activities, a)
	}
	if activities == nil {
		activities = []domain.TaskActivity{}
	}
	return activities, total, nil
}

func (r *postgresTaskRepo) AddChecklist(ctx context.Context, taskID string, title string, sortOrder int) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx,
		`INSERT INTO task.task_checklists (task_id, title, sort_order) VALUES ($1, $2, $3) RETURNING id`,
		taskID, title, sortOrder,
	).Scan(&id)
	return id, err
}

func (r *postgresTaskRepo) GetChecklists(ctx context.Context, taskID string) ([]domain.TaskChecklist, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, task_id, title, is_done, done_by, done_at, sort_order, created_at
		FROM task.task_checklists
		WHERE task_id = $1
		ORDER BY sort_order ASC, created_at ASC
	`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.TaskChecklist
	for rows.Next() {
		var item domain.TaskChecklist
		if err := rows.Scan(&item.ID, &item.TaskID, &item.Title, &item.IsDone, &item.DoneBy, &item.DoneAt, &item.SortOrder, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if items == nil {
		items = []domain.TaskChecklist{}
	}
	return items, nil
}

func (r *postgresTaskRepo) UpdateChecklist(ctx context.Context, id string, isDone bool, doneBy string) error {
	if isDone {
		now := time.Now()
		_, err := r.pool.Exec(ctx,
			"UPDATE task.task_checklists SET is_done = true, done_by = $1, done_at = $2 WHERE id = $3",
			doneBy, now, id,
		)
		return err
	}
	_, err := r.pool.Exec(ctx,
		"UPDATE task.task_checklists SET is_done = false, done_by = NULL, done_at = NULL WHERE id = $1",
		id,
	)
	return err
}

func (r *postgresTaskRepo) DeleteChecklist(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM task.task_checklists WHERE id = $1", id)
	return err
}

func (r *postgresTaskRepo) GetUserSummary(ctx context.Context, userID string) (*domain.UserSummary, error) {
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

func (r *postgresTaskRepo) GetBidTitle(ctx context.Context, bidID string) (string, error) {
	var title string
	err := r.pool.QueryRow(ctx,
		"SELECT COALESCE(title, bid_no, 'Untitled Bid') FROM bid.bid_workspaces WHERE id = $1",
		bidID,
	).Scan(&title)
	if err != nil {
		return "", err
	}
	return title, nil
}

// ────────────────────────────────────────
// Scan helper
// ────────────────────────────────────────

type scannable interface {
	Scan(dest ...interface{}) error
}

func scanTask(s scannable) (*domain.Task, error) {
	var t domain.Task
	err := s.Scan(
		&t.ID, &t.BidID, &t.ParentTaskID, &t.TaskType, &t.TaskCategory, &t.Title, &t.Description,
		&t.Status, &t.Priority, &t.AssignedTo, &t.CreatedBy,
		&t.DueDate, &t.SLADeadline, &t.CompletionPercentage,
		&t.Source, &t.AIConfidence, &t.Metadata,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan task: %w", err)
	}
	return &t, nil
}
