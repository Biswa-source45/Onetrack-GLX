package domain

import "context"

type Repository interface {
	Insert(ctx context.Context, e *Event) error
	List(ctx context.Context, q ListQuery) ([]EventItem, string, bool, error)
}

type Service interface {
	Recorder
	List(ctx context.Context, q ListQuery) (*Page, error)
}
