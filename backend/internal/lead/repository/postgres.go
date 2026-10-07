package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/lead/domain"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewPostgresLeadRepository(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// Create inserts the lead. A bad owner / manager id (unknown user or not a
// UUID at all) surfaces as ErrValidation instead of a 500.
func (r *Repo) Create(ctx context.Context, req *domain.CreateLeadRequest, createdBy, folderName string) (string, error) {
	var details any
	if req.PublishedDetails != nil {
		details = string(req.PublishedDetails)
	}
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO leads.leads (
			publish_status, lead_type, account_name, department_name, location,
			high_level_scope, expected_date, scope_type, category, estimated_value,
			title, published_details, lead_owner_id, reporting_manager_id, created_by, folder_name
		) VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16)
		RETURNING id
	`, req.PublishStatus, req.LeadType, req.AccountName, req.DepartmentName, req.Location,
		req.HighLevelScope, req.ExpectedDate, req.ScopeType, req.Category, req.EstimatedValue,
		req.Title, details, req.LeadOwnerID, req.ReportingManagerID, createdBy, folderName,
	).Scan(&id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "23503" || pgErr.Code == "22P02") {
		return "", fmt.Errorf("%w: selected owner or reporting manager does not exist", domain.ErrValidation)
	}
	return id, err
}

const leadSelect = `
	SELECT l.id, l.publish_status, l.lead_type, l.account_name, l.department_name, l.location,
		l.high_level_scope, to_char(l.expected_date, 'YYYY-MM-DD'), l.scope_type, l.category,
		l.estimated_value::float8, l.title, l.published_details,
		l.lead_owner_id, COALESCE(o.full_name, o.username, 'Deleted user'),
		l.reporting_manager_id, COALESCE(m.full_name, m.username, ''),
		l.created_by, COALESCE(c.full_name, c.username, 'Deleted user'),
		l.folder_name,
		(SELECT COUNT(*) FROM leads.lead_documents d WHERE d.lead_id = l.id),
		l.created_at, l.updated_at,
		l.stage, l.approver_id, COALESCE(a.full_name, a.username, '')
	FROM leads.leads l
	LEFT JOIN auth.users o ON o.id = l.lead_owner_id
	LEFT JOIN auth.users m ON m.id = l.reporting_manager_id
	LEFT JOIN auth.users c ON c.id = l.created_by
	LEFT JOIN auth.users a ON a.id = l.approver_id
`

func scanLead(row pgx.Row) (*domain.Lead, error) {
	var l domain.Lead
	var details []byte
	var managerID, approverID *string
	var managerName, approverName string
	if err := row.Scan(&l.ID, &l.PublishStatus, &l.LeadType, &l.AccountName, &l.DepartmentName, &l.Location,
		&l.HighLevelScope, &l.ExpectedDate, &l.ScopeType, &l.Category,
		&l.EstimatedValue, &l.Title, &details,
		&l.LeadOwner.ID, &l.LeadOwner.FullName,
		&managerID, &managerName,
		&l.CreatedBy.ID, &l.CreatedBy.FullName,
		&l.FolderName, &l.DocumentCount, &l.CreatedAt, &l.UpdatedAt,
		&l.Stage, &approverID, &approverName); err != nil {
		return nil, err
	}
	if details != nil {
		l.PublishedDetails = details
	}
	if managerID != nil {
		l.ReportingManager = &domain.UserSummary{ID: *managerID, FullName: managerName}
	}
	if approverID != nil {
		l.Approver = &domain.UserSummary{ID: *approverID, FullName: approverName}
	}
	return &l, nil
}

// ponytail: returns every lead, newest first; add cursor pagination (see
// platform/pagination) once the list grows past a few thousand rows.
func (r *Repo) List(ctx context.Context) ([]domain.Lead, error) {
	rows, err := r.pool.Query(ctx, leadSelect+` ORDER BY l.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	leads := []domain.Lead{}
	for rows.Next() {
		l, err := scanLead(rows)
		if err != nil {
			return nil, err
		}
		leads = append(leads, *l)
	}
	return leads, rows.Err()
}

func (r *Repo) Get(ctx context.Context, id string) (*domain.Lead, error) {
	l, err := scanLead(r.pool.QueryRow(ctx, leadSelect+` WHERE l.id::text = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		SELECT d.id, d.category, d.original_name, d.stored_path, d.content_type, d.size_bytes,
			COALESCE(u.full_name, u.username), d.created_at
		FROM leads.lead_documents d
		LEFT JOIN auth.users u ON u.id = d.uploaded_by
		WHERE d.lead_id = $1
		ORDER BY d.category NULLS LAST, d.created_at
	`, l.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	l.Documents = []domain.Document{}
	for rows.Next() {
		var d domain.Document
		if err := rows.Scan(&d.ID, &d.Category, &d.OriginalName, &d.StoredPath, &d.ContentType,
			&d.SizeBytes, &d.UploadedBy, &d.CreatedAt); err != nil {
			return nil, err
		}
		l.Documents = append(l.Documents, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	evRows, err := r.pool.Query(ctx, `
		SELECT e.id, COALESCE(e.actor_id::text, ''), COALESCE(u.full_name, u.username, 'Deleted user'),
			e.event_type, e.note, e.created_at
		FROM leads.lead_events e
		LEFT JOIN auth.users u ON u.id = e.actor_id
		WHERE e.lead_id = $1
		ORDER BY e.created_at, e.id
	`, l.ID)
	if err != nil {
		return nil, err
	}
	defer evRows.Close()
	l.Events = []domain.Event{}
	for evRows.Next() {
		var e domain.Event
		if err := evRows.Scan(&e.ID, &e.Actor.ID, &e.Actor.FullName, &e.EventType, &e.Note, &e.CreatedAt); err != nil {
			return nil, err
		}
		l.Events = append(l.Events, e)
	}
	return l, evRows.Err()
}

// Update rewrites the lead's editable details and records the edit.
func (r *Repo) Update(ctx context.Context, id string, req *domain.CreateLeadRequest, actorID string) error {
	var details any
	if req.PublishedDetails != nil {
		details = string(req.PublishedDetails)
	}
	tag, err := r.pool.Exec(ctx, `
		WITH upd AS (
			UPDATE leads.leads SET
				publish_status = $2, lead_type = $3, account_name = $4, department_name = $5, location = $6,
				high_level_scope = $7, expected_date = $8::date, scope_type = $9, category = $10, estimated_value = $11,
				title = $12, published_details = $13::jsonb, lead_owner_id = $14, reporting_manager_id = $15,
				updated_at = NOW()
			WHERE id::text = $1
			RETURNING id
		)
		INSERT INTO leads.lead_events (lead_id, actor_id, event_type)
		SELECT id, $16, 'EDITED' FROM upd
	`, id, req.PublishStatus, req.LeadType, req.AccountName, req.DepartmentName, req.Location,
		req.HighLevelScope, req.ExpectedDate, req.ScopeType, req.Category, req.EstimatedValue,
		req.Title, details, req.LeadOwnerID, req.ReportingManagerID, actorID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "23503" || pgErr.Code == "22P02") {
		return fmt.Errorf("%w: selected owner or reporting manager does not exist", domain.ErrValidation)
	}
	if err == nil && tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return err
}

// Transition moves the lead from one stage to the next and records the step,
// atomically. The "AND stage = from" guard is what makes two people acting
// at once safe: the second finds nothing to update and is told to reload.
// approverID is set only when sending for approval; otherwise the stored
// approver is kept.
func (r *Repo) Transition(ctx context.Context, id, from, to, eventType, actorID string, approverID, note *string) error {
	tag, err := r.pool.Exec(ctx, `
		WITH upd AS (
			UPDATE leads.leads
			SET stage = $3, approver_id = COALESCE($4::uuid, approver_id), updated_at = NOW()
			WHERE id::text = $1 AND stage = $2
			RETURNING id
		)
		INSERT INTO leads.lead_events (lead_id, actor_id, event_type, note)
		SELECT id, $5, $6, $7 FROM upd
	`, id, from, to, approverID, actorID, eventType, note)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("%w: this lead was just changed by someone else — reload the page", domain.ErrValidation)
	}
	return nil
}

// Delete removes the lead (its documents and history rows cascade) together
// with the alerts that link to it, so nobody is left with a notification
// that opens a missing page. Returns the lead's folder so the caller can
// remove its files.
func (r *Repo) Delete(ctx context.Context, id string) (string, error) {
	var folder string
	err := r.pool.QueryRow(ctx, `
		WITH gone AS (
			DELETE FROM leads.leads WHERE id::text = $1 RETURNING id, folder_name
		), cleared AS (
			DELETE FROM public.alerts WHERE link IN (SELECT '/dashboard/leads/' || id::text FROM gone)
		)
		SELECT folder_name FROM gone
	`, id).Scan(&folder)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	return folder, err
}

// UserHasAnyRole reports whether an active user holds one of the roles.
// A malformed id is simply "no".
func (r *Repo) UserHasAnyRole(ctx context.Context, userID string, roles []string) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM auth.users u
			JOIN auth.user_roles ur ON ur.user_id = u.id
			JOIN auth.roles ro ON ro.id = ur.role_id
			WHERE u.id::text = $1 AND u.is_active AND ro.name = ANY($2)
		)
	`, userID, roles).Scan(&ok)
	return ok, err
}

// FolderName returns the lead's document folder, or ErrNotFound.
func (r *Repo) FolderName(ctx context.Context, leadID string) (string, error) {
	var folder string
	err := r.pool.QueryRow(ctx, `SELECT folder_name FROM leads.leads WHERE id::text = $1`, leadID).Scan(&folder)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	return folder, err
}

func (r *Repo) AddDocument(ctx context.Context, leadID string, d *domain.Document, uploadedBy string) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO leads.lead_documents (lead_id, category, original_name, stored_path, content_type, size_bytes, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`, leadID, d.Category, d.OriginalName, d.StoredPath, d.ContentType, d.SizeBytes, uploadedBy).Scan(&d.ID, &d.CreatedAt)
}

// Document returns one document plus its lead's folder, scoped to the lead
// so a document id from another lead can never be fetched through this one.
func (r *Repo) Document(ctx context.Context, leadID, docID string) (*domain.Document, string, error) {
	var d domain.Document
	var folder string
	err := r.pool.QueryRow(ctx, `
		SELECT d.id, d.category, d.original_name, d.stored_path, d.content_type, d.size_bytes, d.created_at, l.folder_name
		FROM leads.lead_documents d
		JOIN leads.leads l ON l.id = d.lead_id
		WHERE l.id::text = $1 AND d.id::text = $2
	`, leadID, docID).Scan(&d.ID, &d.Category, &d.OriginalName, &d.StoredPath, &d.ContentType, &d.SizeBytes, &d.CreatedAt, &folder)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", domain.ErrNotFound
	}
	return &d, folder, err
}

func (r *Repo) DeleteDocument(ctx context.Context, docID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM leads.lead_documents WHERE id = $1`, docID)
	return err
}
