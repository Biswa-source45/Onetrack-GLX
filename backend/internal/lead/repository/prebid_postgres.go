package repository

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/onetrack/backend/internal/lead/domain"
)

const prebidItemCols = `i.id, i.clause_ref, i.product, i.oem, i.pm_remarks, i.dm_comment, i.bm_comment, i.query, i.customer_response`

func scanPrebidItem(row pgx.Row) (domain.PrebidItem, error) {
	var it domain.PrebidItem
	err := row.Scan(&it.ID, &it.ClauseRef, &it.Product, &it.OEM, &it.PMRemarks, &it.DMComment,
		&it.BMComment, &it.Query, &it.CustomerResponse)
	return it, err
}

func (r *Repo) prebidItems(ctx context.Context, leadID string) ([]domain.PrebidItem, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+prebidItemCols+` FROM leads.lead_prebid_items i
		WHERE i.lead_id = $1 ORDER BY i.sort_order, i.created_at, i.id`, leadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.PrebidItem{}
	for rows.Next() {
		it, err := scanPrebidItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// errSheetMoved: a guarded write found nothing — the sheet changed hands (or the
// row is gone) between the caller reading the lead and writing.
var errSheetMoved = fmt.Errorf("%w: the prebid sheet was just changed by someone else — reload the page", domain.ErrValidation)

// PrebidTransition moves the sheet one step and records it, atomically. The
// "AND prebid_stage = from" guard makes two people acting at once safe: the
// second finds nothing to update. Starting also fills the sheet with the lead's
// requested products. assigneeID is set when handing the sheet over; otherwise
// the stored assignee is kept.
func (r *Repo) PrebidTransition(ctx context.Context, id, from, to, action, actorID string, assigneeID, note *string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after Commit

	tag, err := tx.Exec(ctx, `
		UPDATE leads.leads
		SET prebid_stage = $3, prebid_assignee_id = COALESCE($4::uuid, prebid_assignee_id),
			prebid_sent_at = CASE WHEN $3 = 'SENT' THEN NOW() ELSE prebid_sent_at END, updated_at = NOW()
		WHERE id::text = $1 AND prebid_stage = $2
	`, id, from, to, assigneeID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "23503" || pgErr.Code == "22P02") {
		return fmt.Errorf("%w: the chosen person does not exist", domain.ErrValidation)
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errSheetMoved
	}

	if action == domain.PbStart {
		if _, err := tx.Exec(ctx, `
			INSERT INTO leads.lead_prebid_items (lead_id, product, oem, sort_order, created_by)
			SELECT l.id, btrim(p.elem->>'product'), btrim(COALESCE(p.elem->>'oem', '')), p.n::int, $2::uuid
			FROM leads.leads l
			CROSS JOIN LATERAL jsonb_array_elements(
				CASE WHEN jsonb_typeof(l.published_details->'requested_products') = 'array'
				     THEN l.published_details->'requested_products' ELSE '[]'::jsonb END
			) WITH ORDINALITY AS p(elem, n)
			WHERE l.id::text = $1 AND btrim(COALESCE(p.elem->>'product', '')) <> ''
		`, id, actorID); err != nil {
			return err
		}
	}

	// target_id is who the sheet went to (nil for a return, mark-sent or close); note is only what was typed.
	if _, err := tx.Exec(ctx, `
		INSERT INTO leads.lead_events (lead_id, actor_id, event_type, note, target_id)
		VALUES ($1::uuid, $2::uuid, $3, $4::text, $5::uuid)
	`, id, actorID, action, note, assigneeID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// AddPrebidItem appends an empty row, only while the sheet is still at stage.
func (r *Repo) AddPrebidItem(ctx context.Context, leadID, stage, actorID string) (*domain.PrebidItem, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO leads.lead_prebid_items (lead_id, sort_order, created_by)
		SELECT l.id, COALESCE((SELECT MAX(sort_order) FROM leads.lead_prebid_items WHERE lead_id = l.id), 0) + 1, $3::uuid
		FROM leads.leads l WHERE l.id::text = $1 AND l.prebid_stage = $2
		RETURNING id
	`, leadID, stage, actorID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errSheetMoved
	}
	if err != nil {
		return nil, err
	}
	return &domain.PrebidItem{ID: id}, nil
}

// UpdatePrebidItem saves the given cells of one row, only while the sheet is
// still at stage. fields' keys must already be checked against domain.PrebidFields;
// column names come from that map, never from the request.
func (r *Repo) UpdatePrebidItem(ctx context.Context, leadID, itemID, stage string, fields map[string]string) (*domain.PrebidItem, error) {
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	args := []any{leadID, itemID, stage}
	sets := make([]string, 0, len(keys)+1)
	for _, k := range keys {
		args = append(args, fields[k])
		sets = append(sets, fmt.Sprintf("%s = $%d", domain.PrebidFields[k], len(args)))
	}
	sets = append(sets, "updated_at = NOW()")
	it, err := scanPrebidItem(r.pool.QueryRow(ctx, `
		UPDATE leads.lead_prebid_items i SET `+strings.Join(sets, ", ")+`
		FROM leads.leads l
		WHERE i.id::text = $2 AND i.lead_id = l.id AND l.id::text = $1 AND l.prebid_stage = $3
		RETURNING `+prebidItemCols, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errSheetMoved
	}
	if err != nil {
		return nil, err
	}
	return &it, nil
}

// DeletePrebidItem removes one row, only while the sheet is still at stage.
func (r *Repo) DeletePrebidItem(ctx context.Context, leadID, itemID, stage string) error {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM leads.lead_prebid_items i USING leads.leads l
		WHERE i.id::text = $2 AND i.lead_id = l.id AND l.id::text = $1 AND l.prebid_stage = $3
	`, leadID, itemID, stage)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errSheetMoved
	}
	return nil
}
