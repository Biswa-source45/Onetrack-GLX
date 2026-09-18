package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/platform/pagination"
	"github.com/onetrack/backend/internal/systemlog/domain"
)

type postgresRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) domain.Repository {
	return &postgresRepo{pool: pool}
}

func (r *postgresRepo) Insert(ctx context.Context, e *domain.Event) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO auth.system_events (category, event_type, actor_id, target_user_id, summary, details)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, e.Category, e.EventType, e.ActorID, e.TargetUserID, e.Summary, e.Details).
		Scan(&e.ID, &e.CreatedAt)
}

const eventSelectColumns = `
	e.id, e.category, e.event_type, e.summary, e.details, e.created_at,
	e.actor_id, COALESCE(actor.full_name, actor.username, 'Deleted user'), COALESCE(actor.username, ''),
	e.target_user_id, COALESCE(target.full_name, target.username, ''), COALESCE(target.username, '')
`

func scanEvent(row interface{ Scan(dest ...interface{}) error }) (*domain.EventItem, error) {
	var it domain.EventItem
	var actorID *string
	var targetID *string
	var targetFullName, targetUsername string
	if err := row.Scan(
		&it.ID, &it.Category, &it.EventType, &it.Summary, &it.Details, &it.CreatedAt,
		&actorID, &it.Actor.FullName, &it.Actor.Username,
		&targetID, &targetFullName, &targetUsername,
	); err != nil {
		return nil, err
	}
	if actorID != nil {
		it.Actor.ID = *actorID
	}
	if targetID != nil {
		it.TargetUser = &domain.UserRef{ID: *targetID, FullName: targetFullName, Username: targetUsername}
	}
	return &it, nil
}

// List pages the log newest-first, optionally scoped to one category.
func (r *postgresRepo) List(ctx context.Context, q domain.ListQuery) ([]domain.EventItem, string, bool, error) {
	limit := pagination.PageSize(q.Limit, 30, 200)

	query := fmt.Sprintf(`
		SELECT %s
		FROM auth.system_events e
		LEFT JOIN auth.users actor ON actor.id = e.actor_id
		LEFT JOIN auth.users target ON target.id = e.target_user_id
		WHERE 1=1`, eventSelectColumns)
	args := []interface{}{}

	if q.Category != "" {
		args = append(args, q.Category)
		query += fmt.Sprintf(" AND e.category = $%d", len(args))
	}
	if q.Cursor != "" {
		cursorTime, cursorID, err := pagination.Decode(q.Cursor)
		if err != nil {
			return nil, "", false, err
		}
		args = append(args, cursorTime, cursorID)
		query += fmt.Sprintf(" AND (e.created_at, e.id) < ($%d, $%d)", len(args)-1, len(args))
	}
	args = append(args, limit+1)
	query += fmt.Sprintf(" ORDER BY e.created_at DESC, e.id DESC LIMIT $%d", len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", false, err
	}
	defer rows.Close()

	var items []domain.EventItem
	for rows.Next() {
		it, err := scanEvent(rows)
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
		items = []domain.EventItem{}
	}
	return items, nextCursor, hasMore, nil
}
