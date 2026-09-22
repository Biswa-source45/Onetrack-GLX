package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/onetrack/backend/internal/systemconfig/domain"
	systemlogDomain "github.com/onetrack/backend/internal/systemlog/domain"
)

type service struct {
	repo     domain.Repository
	recorder systemlogDomain.Recorder
}

func NewService(repo domain.Repository, recorder systemlogDomain.Recorder) domain.Service {
	return &service{
		repo:     repo,
		recorder: recorder,
	}
}

func (s *service) GetConfig(ctx context.Context, key string) (*domain.SystemConfig, error) {
	return s.repo.Get(ctx, key)
}

func (s *service) GetAllConfigs(ctx context.Context) (map[string]json.RawMessage, error) {
	return s.repo.GetAll(ctx)
}

func (s *service) UpdateConfig(ctx context.Context, key string, value json.RawMessage, actorID string) error {
	if err := s.repo.Set(ctx, key, value, actorID); err != nil {
		return err
	}

	if s.recorder != nil {
		summary := fmt.Sprintf("Updated platform configuration '%s'", key)
		s.recorder.Record(ctx, systemlogDomain.CategoryConfiguration, "CONFIG_UPDATE", actorID, nil, summary, map[string]interface{}{
			"key":   key,
			"value": string(value),
		})
	}

	return nil
}
