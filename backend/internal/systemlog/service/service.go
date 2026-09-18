package service

import (
	"context"
	"encoding/json"
	"log"

	"github.com/onetrack/backend/internal/systemlog/domain"
)

type service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) domain.Service {
	return &service{repo: repo}
}

// Record is best-effort — same contract as the bid module's logAction: a
// failure to write a System Log entry never blocks the mutation it's
// describing, it's only logged server-side for operator visibility.
func (s *service) Record(ctx context.Context, category, eventType, actorID string, targetUserID *string, summary string, details interface{}) {
	var raw json.RawMessage
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			raw = b
		}
	}
	err := s.repo.Insert(ctx, &domain.Event{
		Category:     category,
		EventType:    eventType,
		ActorID:      actorID,
		TargetUserID: targetUserID,
		Summary:      summary,
		Details:      raw,
	})
	if err != nil {
		log.Printf("systemlog: failed to record %s/%s: %v", category, eventType, err)
	}
}

func (s *service) List(ctx context.Context, q domain.ListQuery) (*domain.Page, error) {
	items, nextCursor, hasMore, err := s.repo.List(ctx, q)
	if err != nil {
		return nil, err
	}
	return &domain.Page{Items: items, NextCursor: nextCursor, HasMore: hasMore}, nil
}
