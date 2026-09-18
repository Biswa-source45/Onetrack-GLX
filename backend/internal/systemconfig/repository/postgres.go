package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/systemconfig/domain"
)

type postgresRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) domain.Repository {
	return &postgresRepo{pool: pool}
}

func (r *postgresRepo) Get(ctx context.Context, key string) (*domain.SystemConfig, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT key, value, description, updated_by, updated_at
		FROM auth.system_configurations
		WHERE key = $1
	`, key)

	var c domain.SystemConfig
	err := row.Scan(&c.Key, &c.Value, &c.Description, &c.UpdatedBy, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("query system_configurations: %w", err)
	}

	return &c, nil
}

func (r *postgresRepo) GetAll(ctx context.Context) (map[string]json.RawMessage, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT key, value
		FROM auth.system_configurations
	`)
	if err != nil {
		return nil, fmt.Errorf("query all system_configurations: %w", err)
	}
	defer rows.Close()

	result := make(map[string]json.RawMessage)
	for rows.Next() {
		var k string
		var v json.RawMessage
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan system_configuration: %w", err)
		}
		result[k] = v
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (r *postgresRepo) Set(ctx context.Context, key string, value json.RawMessage, updatedBy string) error {
	var actor *string
	if updatedBy != "" {
		actor = &updatedBy
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO auth.system_configurations (key, value, updated_by, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value,
		    updated_by = EXCLUDED.updated_by,
		    updated_at = NOW()
	`, key, value, actor)
	if err != nil {
		return fmt.Errorf("upsert system_configuration: %w", err)
	}

	return nil
}
