package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/onetrack/backend/internal/bid/domain"
)

const contactCols = `id, bid_id, kind, name, org, designation, phone, email, notes, source, source_ref,
	banned, banned_reason, banned_at, sort_order, created_at, updated_at`

func scanContact(row pgx.Row) (*domain.TenderContact, error) {
	var c domain.TenderContact
	err := row.Scan(&c.ID, &c.BidID, &c.Kind, &c.Name, &c.Org, &c.Designation, &c.Phone, &c.Email, &c.Notes, &c.Source, &c.SourceRef,
		&c.Banned, &c.BannedReason, &c.BannedAt, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt)
	return &c, err
}

// contactErr turns the unique-index violation (same email or phone on the tender) into ErrConflict,
// the backstop for two people adding the same person at the same moment.
func contactErr(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return fmt.Errorf("%w: this email or phone number is already listed on this tender", domain.ErrConflict)
	}
	return err
}

func (r *postgresBidRepo) ListContacts(ctx context.Context, bidID string) ([]domain.TenderContact, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+contactCols+` FROM bid.tender_contacts WHERE bid_id = $1 ORDER BY kind, sort_order, created_at, id`, bidID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.TenderContact{}
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *postgresBidRepo) GetContact(ctx context.Context, bidID, id string) (*domain.TenderContact, error) {
	return scanContact(r.pool.QueryRow(ctx, `SELECT `+contactCols+` FROM bid.tender_contacts WHERE id = $1 AND bid_id = $2`, id, bidID))
}

// CreateContact appends the contact at the end of its column.
func (r *postgresBidRepo) CreateContact(ctx context.Context, c *domain.TenderContact, actorID string) (*domain.TenderContact, error) {
	var by interface{}
	if actorID != "" && actorID != "SYSTEM" {
		by = actorID
	}
	out, err := scanContact(r.pool.QueryRow(ctx, `
		INSERT INTO bid.tender_contacts (bid_id, kind, name, org, designation, phone, email, notes, source, source_ref, sort_order, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
		        COALESCE((SELECT max(sort_order) + 1 FROM bid.tender_contacts WHERE bid_id = $1 AND kind = $2), 1), $11)
		RETURNING `+contactCols,
		c.BidID, c.Kind, c.Name, c.Org, c.Designation, c.Phone, c.Email, c.Notes, c.Source, c.SourceRef, by))
	return out, contactErr(err)
}

// UpdateContact writes the editable fields; a contact that changes column goes to the end of the new one.
func (r *postgresBidRepo) UpdateContact(ctx context.Context, c *domain.TenderContact) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE bid.tender_contacts SET
		    sort_order = CASE WHEN kind = $3 THEN sort_order
		                      ELSE COALESCE((SELECT max(sort_order) + 1 FROM bid.tender_contacts WHERE bid_id = $2 AND kind = $3), 1) END,
		    kind = $3, name = $4, org = $5, designation = $6, phone = $7, email = $8, notes = $9,
		    banned = $10, banned_reason = $11,
		    banned_at = CASE WHEN $10 THEN COALESCE(banned_at, NOW()) ELSE NULL END,
		    updated_at = NOW()
		WHERE id = $1 AND bid_id = $2`,
		c.ID, c.BidID, c.Kind, c.Name, c.Org, c.Designation, c.Phone, c.Email, c.Notes, c.Banned, c.BannedReason)
	if err = contactErr(err); err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *postgresBidRepo) DeleteContact(ctx context.Context, bidID, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM bid.tender_contacts WHERE id = $1 AND bid_id = $2`, id, bidID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// ReorderContacts applies a drag-and-drop result in one transaction; every id must belong to the tender.
func (r *postgresBidRepo) ReorderContacts(ctx context.Context, bidID string, items []domain.ReorderContactItem) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after Commit
	for _, it := range items {
		tag, err := tx.Exec(ctx, `UPDATE bid.tender_contacts SET kind = $1, sort_order = $2, updated_at = NOW() WHERE id = $3 AND bid_id = $4`,
			it.Kind, it.SortOrder, it.ID, bidID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
	}
	return tx.Commit(ctx)
}
