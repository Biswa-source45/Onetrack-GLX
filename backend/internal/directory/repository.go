package directory

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repo reads and writes only rows the caller owns: every query carries owner_id, so an id that belongs
// to someone else looks exactly like one that does not exist. Ids are compared as text so a malformed
// id is "not found" rather than a database error.
type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

func mapErr(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return ErrDuplicate
	}
	return err
}

const entryCols = `e.id::text, e.name, e.sector, e.location, e.website, e.notes, e.created_at, e.updated_at`

func (r *Repo) List(ctx context.Context, owner, kind string) ([]Entry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+entryCols+`, (SELECT count(*) FROM directory.contacts c WHERE c.entry_id = e.id)
		FROM directory.entries e
		WHERE e.owner_id = $1::uuid AND e.kind = $2
		ORDER BY lower(e.name), e.created_at`, owner, kind)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Entry{}
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.Name, &e.Sector, &e.Location, &e.Website, &e.Notes, &e.CreatedAt, &e.UpdatedAt, &e.ContactCount); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *Repo) Get(ctx context.Context, owner, kind, id string) (*Entry, error) {
	var e Entry
	err := r.pool.QueryRow(ctx, `
		SELECT `+entryCols+` FROM directory.entries e
		WHERE e.id::text = $1 AND e.owner_id = $2::uuid AND e.kind = $3`, id, owner, kind,
	).Scan(&e.ID, &e.Name, &e.Sector, &e.Location, &e.Website, &e.Notes, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, mapErr(err)
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, entry_id::text, name, designation, email, phone, remarks, created_at, updated_at
		FROM directory.contacts WHERE entry_id::text = $1 ORDER BY sort_order, created_at`, e.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	e.Contacts = []Contact{}
	for rows.Next() {
		var c Contact
		if err := rows.Scan(&c.ID, &c.EntryID, &c.Name, &c.Designation, &c.Email, &c.Phone, &c.Remarks, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		e.Contacts = append(e.Contacts, c)
	}
	e.ContactCount = len(e.Contacts)
	return &e, rows.Err()
}

func (r *Repo) Create(ctx context.Context, owner, kind string, in EntryInput) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO directory.entries (kind, owner_id, name, sector, location, website, notes)
		VALUES ($1, $2::uuid, $3, $4, $5, $6, $7) RETURNING id::text`,
		kind, owner, in.Name, in.Sector, in.Location, in.Website, in.Notes).Scan(&id)
	return id, mapErr(err)
}

func (r *Repo) Update(ctx context.Context, owner, kind, id string, in EntryInput) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE directory.entries SET name=$4, sector=$5, location=$6, website=$7, notes=$8, updated_at=NOW()
		WHERE id::text = $1 AND owner_id = $2::uuid AND kind = $3`,
		id, owner, kind, in.Name, in.Sector, in.Location, in.Website, in.Notes)
	return affected(tag.RowsAffected(), err)
}

func (r *Repo) Delete(ctx context.Context, owner, kind, id string) error {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM directory.entries WHERE id::text = $1 AND owner_id = $2::uuid AND kind = $3`, id, owner, kind)
	return affected(tag.RowsAffected(), err)
}

func (r *Repo) AddContact(ctx context.Context, owner, kind, entryID string, in ContactInput) error {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO directory.contacts (entry_id, name, designation, email, phone, remarks, sort_order)
		SELECT e.id, $4, $5, $6, $7, $8,
		       COALESCE((SELECT max(c.sort_order) FROM directory.contacts c WHERE c.entry_id = e.id), 0) + 1
		FROM directory.entries e
		WHERE e.id::text = $1 AND e.owner_id = $2::uuid AND e.kind = $3
		RETURNING id::text`, entryID, owner, kind, in.Name, in.Designation, in.Email, in.Phone, in.Remarks).Scan(&id)
	return mapErr(err)
}

func (r *Repo) UpdateContact(ctx context.Context, owner, kind, entryID, contactID string, in ContactInput) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE directory.contacts c
		SET name=$5, designation=$6, email=$7, phone=$8, remarks=$9, updated_at=NOW()
		FROM directory.entries e
		WHERE c.id::text = $1 AND c.entry_id = e.id AND e.id::text = $2 AND e.owner_id = $3::uuid AND e.kind = $4`,
		contactID, entryID, owner, kind, in.Name, in.Designation, in.Email, in.Phone, in.Remarks)
	return affected(tag.RowsAffected(), err)
}

func (r *Repo) DeleteContact(ctx context.Context, owner, kind, entryID, contactID string) error {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM directory.contacts c USING directory.entries e
		WHERE c.id::text = $1 AND c.entry_id = e.id AND e.id::text = $2 AND e.owner_id = $3::uuid AND e.kind = $4`,
		contactID, entryID, owner, kind)
	return affected(tag.RowsAffected(), err)
}

// affected turns "no row matched" into ErrNotFound.
func affected(n int64, err error) error {
	if err != nil {
		return mapErr(err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
