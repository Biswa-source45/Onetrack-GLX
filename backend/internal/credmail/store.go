package credmail

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrBatchRunning  = errors.New("a credential mail batch is already running")
	ErrBatchNotFound = errors.New("batch not found")
)

// Kind is which mail a user gets.
type Kind string

const (
	KindInitial Kind = "INITIAL"       // login details with the initial password
	KindReset   Kind = "RESET_CONFIRM" // "you have reset your password"
	// KindTemp exists only in a send request: login details with a password an admin set (a force reset).
	// It is stored and mailed as INITIAL; the password is typed in by the admin, checked and never saved.
	KindTemp Kind = "TEMP_PASSWORD"
)

// Candidate is a user row as read for classification. PasswordHash never leaves this package.
type Candidate struct {
	ID          string
	Username    string
	FullName    string
	Email       string
	Roles       []string
	ForceChange bool
	IsActive    bool
	hash        string
	// LastAlerted is the most recent SENT mail per kind.
	LastAlerted map[Kind]*time.Time
}

// Item is one mail of a batch.
type Item struct {
	UserID   string
	Kind     Kind
	Email    string
	Username string
	FullName string
	Roles    []string
	Password string // only in memory: never written to the database
	Temp     bool   // the password was set by an admin (changes the wording of the mail)
}

type FailedItem struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Kind     Kind   `json:"kind"`
	Error    string `json:"error"`
}

type Batch struct {
	ID         string       `json:"id"`
	Status     string       `json:"status"`
	Total      int          `json:"total"`
	Sent       int          `json:"sent"`
	Failed     int          `json:"failed"`
	StartedAt  time.Time    `json:"started_at"`
	FinishedAt *time.Time   `json:"finished_at,omitempty"`
	Failures   []FailedItem `json:"failures"`
}

// Store is what the service needs from the database.
type Store interface {
	Candidates(ctx context.Context) ([]Candidate, error)
	RunningBatch(ctx context.Context) (string, error)
	CreateBatch(ctx context.Context, startedBy string, items []Item) (string, error)
	MarkItem(ctx context.Context, batchID, userID string, sent bool, errMsg string) error
	FinishBatch(ctx context.Context, batchID, status string) error
	SweepStale(ctx context.Context) (int, error)
	GetBatch(ctx context.Context, id string) (*Batch, error)
}

type pgStore struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) Store { return &pgStore{pool: pool} }

func (s *pgStore) Candidates(ctx context.Context) ([]Candidate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.email, ''), u.password_hash,
		       u.force_password_change, u.is_active,
		       COALESCE((SELECT array_agg(r.name ORDER BY ur.role_order, ur.is_primary DESC, ur.assigned_at)
		                   FROM auth.user_roles ur JOIN auth.roles r ON r.id = ur.role_id
		                  WHERE ur.user_id = u.id), '{}'),
		       (SELECT MAX(m.sent_at) FROM auth.credential_mails m WHERE m.user_id = u.id AND m.kind = 'INITIAL' AND m.status = 'SENT'
		           AND (u.password_changed_at IS NULL OR m.sent_at >= u.password_changed_at)),
		       (SELECT MAX(m.sent_at) FROM auth.credential_mails m WHERE m.user_id = u.id AND m.kind = 'RESET_CONFIRM' AND m.status = 'SENT'
		           AND (u.password_changed_at IS NULL OR m.sent_at >= u.password_changed_at))
		  FROM auth.users u
		 ORDER BY LOWER(COALESCE(NULLIF(u.full_name, ''), u.username))`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()
	var out []Candidate
	for rows.Next() {
		var c Candidate
		var initial, reset *time.Time
		if err := rows.Scan(&c.ID, &c.Username, &c.FullName, &c.Email, &c.hash, &c.ForceChange, &c.IsActive, &c.Roles, &initial, &reset); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		c.LastAlerted = map[Kind]*time.Time{KindInitial: initial, KindReset: reset}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *pgStore) RunningBatch(ctx context.Context) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id FROM auth.credential_mail_batches WHERE status = 'RUNNING' LIMIT 1`).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// CreateBatch writes the batch and one PENDING row per mail in one transaction. The unique index on RUNNING
// batches turns a concurrent second send into ErrBatchRunning instead of needing a lock.
func (s *pgStore) CreateBatch(ctx context.Context, startedBy string, items []Item) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after Commit

	var id string
	err = tx.QueryRow(ctx,
		`INSERT INTO auth.credential_mail_batches (started_by, total) VALUES ($1, $2) RETURNING id`,
		startedBy, len(items)).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return "", ErrBatchRunning
		}
		return "", fmt.Errorf("create batch: %w", err)
	}
	for _, it := range items {
		if _, err := tx.Exec(ctx,
			`INSERT INTO auth.credential_mails (batch_id, user_id, kind, email) VALUES ($1, $2, $3, $4)`,
			id, it.UserID, string(it.Kind), it.Email); err != nil {
			return "", fmt.Errorf("queue mail: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return id, nil
}

func (s *pgStore) MarkItem(ctx context.Context, batchID, userID string, sent bool, errMsg string) error {
	if sent {
		_, err := s.pool.Exec(ctx,
			`UPDATE auth.credential_mails SET status = 'SENT', sent_at = NOW(), error = '' WHERE batch_id = $1 AND user_id = $2`,
			batchID, userID)
		return err
	}
	_, err := s.pool.Exec(ctx,
		`UPDATE auth.credential_mails SET status = 'FAILED', error = $3 WHERE batch_id = $1 AND user_id = $2`,
		batchID, userID, errMsg)
	return err
}

// FinishBatch closes a batch. Anything still PENDING (a panic, a restart) is marked FAILED so it can be retried.
func (s *pgStore) FinishBatch(ctx context.Context, batchID, status string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx,
		`UPDATE auth.credential_mails SET status = 'FAILED', error = 'interrupted before sending' WHERE batch_id = $1 AND status = 'PENDING'`,
		batchID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE auth.credential_mail_batches SET status = $2, finished_at = NOW() WHERE id = $1`,
		batchID, status); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SweepStale runs once at start-up: a batch still RUNNING then belongs to a process that died, and would
// otherwise block every future send.
func (s *pgStore) SweepStale(ctx context.Context) (int, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx, `
		UPDATE auth.credential_mails SET status = 'FAILED', error = 'interrupted before sending'
		 WHERE status = 'PENDING' AND batch_id IN (SELECT id FROM auth.credential_mail_batches WHERE status = 'RUNNING')`); err != nil {
		return 0, err
	}
	tag, err := tx.Exec(ctx, `UPDATE auth.credential_mail_batches SET status = 'FAILED', finished_at = NOW() WHERE status = 'RUNNING'`)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), tx.Commit(ctx)
}

func (s *pgStore) GetBatch(ctx context.Context, id string) (*Batch, error) {
	var b Batch
	err := s.pool.QueryRow(ctx, `
		SELECT b.id, b.status, b.total, b.started_at, b.finished_at,
		       COUNT(m.*) FILTER (WHERE m.status = 'SENT'),
		       COUNT(m.*) FILTER (WHERE m.status = 'FAILED')
		  FROM auth.credential_mail_batches b
		  LEFT JOIN auth.credential_mails m ON m.batch_id = b.id
		 WHERE b.id = $1
		 GROUP BY b.id`, id).Scan(&b.ID, &b.Status, &b.Total, &b.StartedAt, &b.FinishedAt, &b.Sent, &b.Failed)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBatchNotFound
	}
	if err != nil {
		return nil, err
	}
	b.Failures = []FailedItem{}
	rows, err := s.pool.Query(ctx, `
		SELECT COALESCE(u.username, ''), m.email, m.kind, m.error
		  FROM auth.credential_mails m LEFT JOIN auth.users u ON u.id = m.user_id
		 WHERE m.batch_id = $1 AND m.status = 'FAILED' ORDER BY m.id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var f FailedItem
		if err := rows.Scan(&f.Username, &f.Email, &f.Kind, &f.Error); err != nil {
			return nil, err
		}
		b.Failures = append(b.Failures, f)
	}
	return &b, rows.Err()
}
