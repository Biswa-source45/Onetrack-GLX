package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/bid/domain"
)

// DocsRepo stores the metadata of a tender's documents. It is a concrete type
// on its own (not part of BidRepository) because only the documents handler
// needs it.
type DocsRepo struct{ pool *pgxpool.Pool }

func NewDocsRepo(pool *pgxpool.Pool) *DocsRepo { return &DocsRepo{pool: pool} }

const docCols = `d.id, d.bid_id, d.name, d.original_name, d.stored_path, d.content_type, d.size_bytes,
	d.uploaded_by, COALESCE(u.full_name, ''), d.created_at, d.updated_at`

func scanDoc(row pgx.Row) (*domain.TenderDocument, error) {
	var d domain.TenderDocument
	var by *string
	if err := row.Scan(&d.ID, &d.BidID, &d.Name, &d.OriginalName, &d.StoredPath, &d.ContentType, &d.SizeBytes,
		&by, &d.UploadedByName, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, err
	}
	if by != nil {
		d.UploadedBy = *by
	}
	return &d, nil
}

// EnsureFolder returns the tender's docs folder, setting it to candidate if it
// has none yet. One atomic UPDATE, so two simultaneous first uploads agree.
func (r *DocsRepo) EnsureFolder(ctx context.Context, bidID, candidate string) (string, error) {
	var folder string
	err := r.pool.QueryRow(ctx, `
		UPDATE bid.bid_workspaces SET docs_folder = COALESCE(docs_folder, $2)
		WHERE id = $1 RETURNING docs_folder`, bidID, candidate).Scan(&folder)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	return folder, err
}

// Folder returns the tender's docs folder, or "" when it never had one.
func (r *DocsRepo) Folder(ctx context.Context, bidID string) (string, error) {
	var folder *string
	err := r.pool.QueryRow(ctx, `SELECT docs_folder FROM bid.bid_workspaces WHERE id = $1`, bidID).Scan(&folder)
	if errors.Is(err, pgx.ErrNoRows) || folder == nil {
		return "", nil
	}
	return *folder, err
}

func (r *DocsRepo) List(ctx context.Context, bidID string) ([]domain.TenderDocument, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+docCols+` FROM bid.tender_documents d
		LEFT JOIN auth.users u ON u.id = d.uploaded_by
		WHERE d.bid_id = $1 ORDER BY d.created_at, d.id`, bidID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.TenderDocument{}
	for rows.Next() {
		d, err := scanDoc(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

// Get is scoped to the tender: a document id from another tender is NotFound.
func (r *DocsRepo) Get(ctx context.Context, bidID, docID string) (*domain.TenderDocument, error) {
	d, err := scanDoc(r.pool.QueryRow(ctx, `
		SELECT `+docCols+` FROM bid.tender_documents d
		LEFT JOIN auth.users u ON u.id = d.uploaded_by
		WHERE d.bid_id = $1 AND d.id = $2`, bidID, docID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return d, err
}

func (r *DocsRepo) Add(ctx context.Context, d *domain.TenderDocument) (*domain.TenderDocument, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO bid.tender_documents (bid_id, name, original_name, stored_path, content_type, size_bytes, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::uuid) RETURNING id`,
		d.BidID, d.Name, d.OriginalName, d.StoredPath, d.ContentType, d.SizeBytes, d.UploadedBy).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, d.BidID, id)
}

// Update rewrites the mutable columns of one document (rename and/or replace).
func (r *DocsRepo) Update(ctx context.Context, d *domain.TenderDocument) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE bid.tender_documents
		SET name = $3, original_name = $4, stored_path = $5, content_type = $6, size_bytes = $7, updated_at = $8
		WHERE bid_id = $1 AND id = $2`,
		d.BidID, d.ID, d.Name, d.OriginalName, d.StoredPath, d.ContentType, d.SizeBytes, time.Now())
	return err
}

// DiscardTender removes a tender that was created moments ago in the same
// request and then failed to store its main document (same statement as the
// bid repo's PermanentDelete; rows cascade).
func (r *DocsRepo) DiscardTender(ctx context.Context, bidID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM bid.bid_workspaces WHERE id = $1`, bidID)
	return err
}

func (r *DocsRepo) Delete(ctx context.Context, bidID, docID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM bid.tender_documents WHERE bid_id = $1 AND id = $2`, bidID, docID)
	return err
}
