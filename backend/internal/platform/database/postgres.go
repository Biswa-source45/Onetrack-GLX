package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/platform/config"
)

func NewPostgresPool(ctx context.Context, cfg config.DatabaseConfig) (*pgxpool.Pool, error) {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName, cfg.SSLMode,
	)

	poolCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	poolCfg.MaxConns = cfg.MaxConns
	poolCfg.MinConns = cfg.MinConns

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Postgres can take a while to accept connections on a brand-new volume
	// (initdb, then an internal stop/restart cycle) — a single Ping used to
	// make the whole server exit immediately if it landed in that window, so
	// this retries for up to a minute instead of failing on the first miss.
	const maxAttempts = 30
	var pingErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		pingErr = pool.Ping(ctx)
		if pingErr == nil {
			return pool, nil
		}
		log.Printf("Database not ready yet (attempt %d/%d): %v", attempt, maxAttempts, pingErr)
		time.Sleep(2 * time.Second)
	}

	pool.Close()
	return nil, fmt.Errorf("failed to ping database after %d attempts: %w", maxAttempts, pingErr)
}
