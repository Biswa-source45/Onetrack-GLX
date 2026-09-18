package domain

import (
	"context"
	"encoding/json"
)

type Repository interface {
	Get(ctx context.Context, key string) (*SystemConfig, error)
	GetAll(ctx context.Context) (map[string]json.RawMessage, error)
	Set(ctx context.Context, key string, value json.RawMessage, updatedBy string) error
}

type Service interface {
	GetConfig(ctx context.Context, key string) (*SystemConfig, error)
	GetAllConfigs(ctx context.Context) (map[string]json.RawMessage, error)
	UpdateConfig(ctx context.Context, key string, value json.RawMessage, actorID string) error
}
