package repository

import (
	"context"
	"fmt"
	"strings"

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
	// actor_id is a UUID column; an empty string isn't a valid one. Failed
	// logins against a username that doesn't exist have no real actor to
	// attribute the attempt to, so that case (and only that case — every
	// other caller always passes a real id) needs NULL, not ''.
	var actorID interface{}
	if e.ActorID != "" {
		actorID = e.ActorID
	}
	return r.pool.QueryRow(ctx, `
		INSERT INTO auth.system_events (category, event_type, actor_id, target_user_id, summary, details)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, e.Category, e.EventType, actorID, e.TargetUserID, e.Summary, e.Details).
		Scan(&e.ID, &e.CreatedAt)
}

// logSource is one table feeding the System Logs feed. Every source is
// projected to the same columns so they can be UNION ALL'd; t is the alias
// the cursor/actor predicates are written against.
type logSource struct {
	category string // fixed category, or "" for auth.system_events (it has its own column)
	from     string // FROM clause, aliased t
	actor    string // actor id expression
	where    string // extra fixed predicate, or ""
	cols     string // category, event_type, summary, details, target_user_id, bid_id, bid_title
}

var logSources = []logSource{
	{
		from: "auth.system_events t", actor: "t.actor_id",
		cols: "t.category, t.event_type, t.summary, t.details, t.target_user_id, NULL::uuid, ''",
	},
	{
		// Everything done on a tender — the Action Ledger. bid_title was
		// captured at write time, so a deleted tender's rows stay readable.
		category: domain.CategoryTender,
		from:     "bid.bid_stage_history t", actor: "t.transitioned_by",
		cols: `'TENDER', COALESCE(t.event_type, 'STAGE_CHANGE'),
		       COALESCE(NULLIF(t.transition_reason, ''), 'Moved ' || COALESCE(t.from_stage || ' → ', 'to ') || t.to_stage),
		       t.details, NULL::uuid, t.bid_id, COALESCE(NULLIF(t.bid_title, ''), 'Deleted tender')`,
	},
	{
		category: domain.CategoryFeedback,
		from:     "feedback.tickets t", actor: "t.user_id",
		cols: `'FEEDBACK', 'TICKET_SUBMITTED',
		       'Submitted a feedback ticket (' || COALESCE(NULLIF(t.custom_category, ''), t.category) || ')',
		       NULL::jsonb, NULL::uuid, NULL::uuid, ''`,
	},
	{
		// from_status IS NULL is the row written at submission — already
		// covered by the feedback.tickets source above.
		category: domain.CategoryFeedback,
		from:     "feedback.ticket_status_history t", actor: "t.changed_by", where: "t.from_status IS NOT NULL",
		cols: `'FEEDBACK', 'TICKET_STATUS_CHANGED',
		       'Feedback ticket moved ' || t.from_status || ' → ' || t.to_status || COALESCE(' — ' || NULLIF(t.note, ''), ''),
		       NULL::jsonb, NULL::uuid, NULL::uuid, ''`,
	},
	{
		category: domain.CategoryLead,
		from:     "leads.leads t", actor: "t.created_by",
		cols: `'LEAD', 'LEAD_CREATED',
		       'Created lead: ' || COALESCE(NULLIF(t.title, ''), t.account_name),
		       NULL::jsonb, NULL::uuid, NULL::uuid, ''`,
	},
	{
		// Every later step on a lead: edits and the approval workflow.
		category: domain.CategoryLead,
		from:     "leads.lead_events t JOIN leads.leads l ON l.id = t.lead_id", actor: "t.actor_id",
		cols: `'LEAD', 'LEAD_' || t.event_type,
		       CASE t.event_type
		           WHEN 'EDITED' THEN 'Edited lead'
		           WHEN 'SENT_FOR_APPROVAL' THEN 'Sent lead for approval'
		           WHEN 'APPROVED' THEN 'Approved lead'
		           WHEN 'SENT_BACK' THEN 'Sent lead back for changes'
		           WHEN 'GO' THEN 'Marked lead as Go'
		           WHEN 'NO_GO' THEN 'Marked lead as No-Go'
		           ELSE t.event_type
		       END || ': ' || COALESCE(NULLIF(l.title, ''), l.account_name) || COALESCE(' — ' || NULLIF(t.note, ''), ''),
		       NULL::jsonb, NULL::uuid, NULL::uuid, ''`,
	},
}

// List pages the merged feed newest-first, optionally scoped to one category
// and/or one actor.
//
// Each source applies the cursor, the filters and its own LIMIT before the
// UNION, so every branch is a bounded scan on its (created_at, id) index —
// the cost of a page stays flat however large the tables grow, and the outer
// sort only ever sees a few pages' worth of rows.
func (r *postgresRepo) List(ctx context.Context, q domain.ListQuery) ([]domain.EventItem, string, bool, error) {
	limit := pagination.PageSize(q.Limit, 30, 200)

	args := []interface{}{limit + 1}
	arg := func(v interface{}) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	common := ""
	if q.Cursor != "" {
		cursorTime, cursorID, err := pagination.Decode(q.Cursor)
		if err != nil {
			return nil, "", false, err
		}
		common += fmt.Sprintf(" AND (t.created_at, t.id) < (%s, %s::uuid)", arg(cursorTime), arg(cursorID))
	}

	var branches []string
	for _, src := range logSources {
		where := "WHERE 1=1" + common
		switch {
		case q.Category == "":
		case src.category == "":
			// auth.system_events holds several categories of its own.
			where += " AND t.category = " + arg(q.Category)
		case src.category != q.Category:
			continue
		}
		if src.where != "" {
			where += " AND " + src.where
		}
		if q.ActorID != "" {
			where += fmt.Sprintf(" AND %s = %s::uuid", src.actor, arg(q.ActorID))
		}
		branches = append(branches, fmt.Sprintf(
			"(SELECT t.id, t.created_at, %s AS actor_id, %s FROM %s %s ORDER BY t.created_at DESC, t.id DESC LIMIT $1)",
			src.actor, src.cols, src.from, where))
	}

	query := fmt.Sprintf(`
		SELECT x.id, x.category, x.event_type, x.summary, x.details, x.created_at,
		       x.actor_id, COALESCE(actor.full_name, actor.username, 'Deleted user'), COALESCE(actor.username, ''),
		       x.target_user_id, COALESCE(target.full_name, target.username, ''), COALESCE(target.username, ''),
		       x.bid_id, x.bid_title
		FROM (%s) AS x (id, created_at, actor_id, category, event_type, summary, details, target_user_id, bid_id, bid_title)
		LEFT JOIN auth.users actor ON actor.id = x.actor_id
		LEFT JOIN auth.users target ON target.id = x.target_user_id
		ORDER BY x.created_at DESC, x.id DESC
		LIMIT $1`, strings.Join(branches, "\nUNION ALL\n"))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", false, err
	}
	defer rows.Close()

	items := []domain.EventItem{}
	for rows.Next() {
		var it domain.EventItem
		var actorID, targetID *string
		var targetFullName, targetUsername string
		if err := rows.Scan(
			&it.ID, &it.Category, &it.EventType, &it.Summary, &it.Details, &it.CreatedAt,
			&actorID, &it.Actor.FullName, &it.Actor.Username,
			&targetID, &targetFullName, &targetUsername,
			&it.BidID, &it.BidTitle,
		); err != nil {
			return nil, "", false, err
		}
		if actorID != nil {
			it.Actor.ID = *actorID
		}
		if targetID != nil {
			it.TargetUser = &domain.UserRef{ID: *targetID, FullName: targetFullName, Username: targetUsername}
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, "", false, err
	}

	hasMore := len(items) > limit
	nextCursor := ""
	if hasMore {
		items = items[:limit]
		last := items[len(items)-1]
		nextCursor = pagination.Encode(last.CreatedAt, last.ID)
	}
	return items, nextCursor, hasMore, nil
}
