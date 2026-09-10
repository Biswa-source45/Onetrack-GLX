package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/feedback/domain"
	"github.com/onetrack/backend/internal/platform/pagination"
)

type postgresTicketRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresTicketRepository(pool *pgxpool.Pool) domain.TicketRepository {
	return &postgresTicketRepo{pool: pool}
}

func (r *postgresTicketRepo) Create(ctx context.Context, t *domain.Ticket) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO feedback.tickets (user_id, category, custom_category, description, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`, t.UserID, t.Category, t.CustomCategory, t.Description, t.Status).
		Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

const ticketSelectColumns = `
	t.id, t.category, t.custom_category, t.description, t.status,
	t.created_at, t.updated_at, t.resolved_at,
	t.user_id, COALESCE(reporter.full_name, reporter.username, 'Deleted user'), COALESCE(reporter.username, ''),
	t.resolved_by, COALESCE(resolver.full_name, resolver.username, ''), COALESCE(resolver.username, '')
`

func scanTicket(row interface {
	Scan(dest ...interface{}) error
}) (*domain.TicketResponse, error) {
	var it domain.TicketResponse
	var reporterID string
	var resolvedByID *string
	var resolverFullName, resolverUsername string
	if err := row.Scan(
		&it.ID, &it.Category, &it.CustomCategory, &it.Description, &it.Status,
		&it.CreatedAt, &it.UpdatedAt, &it.ResolvedAt,
		&reporterID, &it.Reporter.FullName, &it.Reporter.Username,
		&resolvedByID, &resolverFullName, &resolverUsername,
	); err != nil {
		return nil, err
	}
	it.Reporter.ID = reporterID
	if resolvedByID != nil {
		it.ResolvedBy = &domain.UserSummary{ID: *resolvedByID, FullName: resolverFullName, Username: resolverUsername}
	}
	return &it, nil
}

func (r *postgresTicketRepo) GetByID(ctx context.Context, id string) (*domain.TicketResponse, error) {
	row := r.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM feedback.tickets t
		LEFT JOIN auth.users reporter ON reporter.id = t.user_id
		LEFT JOIN auth.users resolver ON resolver.id = t.resolved_by
		WHERE t.id = $1
	`, ticketSelectColumns), id)
	return scanTicket(row)
}

// List pages tickets newest-first. UserID scopes to one reporter ("my
// tickets"); Status/Category additionally filter the Super Admin view.
func (r *postgresTicketRepo) List(ctx context.Context, params domain.ListTicketsParams) ([]domain.TicketResponse, string, bool, error) {
	limit := pagination.PageSize(params.Limit, 30, 200)

	query := fmt.Sprintf(`
		SELECT %s
		FROM feedback.tickets t
		LEFT JOIN auth.users reporter ON reporter.id = t.user_id
		LEFT JOIN auth.users resolver ON resolver.id = t.resolved_by
		WHERE 1=1`, ticketSelectColumns)
	args := []interface{}{}

	if params.UserID != "" {
		args = append(args, params.UserID)
		query += fmt.Sprintf(" AND t.user_id = $%d", len(args))
	}
	if params.Status != "" {
		args = append(args, params.Status)
		query += fmt.Sprintf(" AND t.status = $%d", len(args))
	}
	if params.Category != "" {
		args = append(args, params.Category)
		query += fmt.Sprintf(" AND t.category = $%d", len(args))
	}
	if params.Cursor != "" {
		cursorTime, cursorID, err := pagination.Decode(params.Cursor)
		if err != nil {
			return nil, "", false, err
		}
		args = append(args, cursorTime, cursorID)
		query += fmt.Sprintf(" AND (t.created_at, t.id) < ($%d, $%d)", len(args)-1, len(args))
	}
	args = append(args, limit+1)
	query += fmt.Sprintf(" ORDER BY t.created_at DESC, t.id DESC LIMIT $%d", len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", false, err
	}
	defer rows.Close()

	var items []domain.TicketResponse
	for rows.Next() {
		it, err := scanTicket(rows)
		if err != nil {
			return nil, "", false, err
		}
		items = append(items, *it)
	}
	if err := rows.Err(); err != nil {
		return nil, "", false, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}
	nextCursor := ""
	if hasMore {
		last := items[len(items)-1]
		nextCursor = pagination.Encode(last.CreatedAt, last.ID)
	}
	if items == nil {
		items = []domain.TicketResponse{}
	}
	return items, nextCursor, hasMore, nil
}

func (r *postgresTicketRepo) CountOpen(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM feedback.tickets WHERE status != $1`, domain.StatusResolved).Scan(&count)
	return count, err
}

func (r *postgresTicketRepo) UpdateStatus(ctx context.Context, id string, status string, resolvedBy *string) error {
	if status == domain.StatusResolved {
		_, err := r.pool.Exec(ctx, `
			UPDATE feedback.tickets
			SET status = $1, resolved_by = $2, resolved_at = NOW(), updated_at = NOW()
			WHERE id = $3
		`, status, resolvedBy, id)
		return err
	}
	// Moving off RESOLVED (e.g. reopened to IN_PROGRESS) clears the resolution
	// stamp — it's no longer true that this ticket was resolved by anyone.
	_, err := r.pool.Exec(ctx, `
		UPDATE feedback.tickets
		SET status = $1, resolved_by = NULL, resolved_at = NULL, updated_at = NOW()
		WHERE id = $2
	`, status, id)
	return err
}

func (r *postgresTicketRepo) AddStatusHistory(ctx context.Context, event *domain.TicketStatusHistoryInsert) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO feedback.ticket_status_history (ticket_id, from_status, to_status, changed_by, note)
		VALUES ($1, $2, $3, $4, $5)
	`, event.TicketID, event.FromStatus, event.ToStatus, event.ChangedBy, event.Note)
	return err
}

func (r *postgresTicketRepo) GetStatusHistory(ctx context.Context, ticketID string) ([]domain.TicketStatusEvent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT h.id, h.from_status, h.to_status, h.note, h.created_at,
		       h.changed_by, COALESCE(u.full_name, u.username, 'System'), COALESCE(u.username, '')
		FROM feedback.ticket_status_history h
		LEFT JOIN auth.users u ON u.id = h.changed_by
		WHERE h.ticket_id = $1
		ORDER BY h.created_at ASC
	`, ticketID)
	if err != nil {
		return nil, fmt.Errorf("list ticket status history: %w", err)
	}
	defer rows.Close()

	events := []domain.TicketStatusEvent{}
	for rows.Next() {
		var e domain.TicketStatusEvent
		var changedByID *string
		var fullName, username string
		if err := rows.Scan(&e.ID, &e.FromStatus, &e.ToStatus, &e.Note, &e.CreatedAt, &changedByID, &fullName, &username); err != nil {
			return nil, fmt.Errorf("scan ticket status event: %w", err)
		}
		if changedByID != nil {
			e.ChangedBy = &domain.UserSummary{ID: *changedByID, FullName: fullName, Username: username}
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
