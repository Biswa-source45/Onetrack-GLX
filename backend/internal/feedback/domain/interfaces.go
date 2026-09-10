package domain

import "context"

// FieldMemory is the write side of GlobX's existing "Field Memory" feature
// (bid.field_suggestions) — reused here so a custom "Other" category gets
// remembered and suggested next time, the same way any other free-text
// field does, instead of a parallel autocomplete mechanism. Any type with
// this one method (bid's repository already has it) satisfies this
// interface, so no adapter is needed to wire it in.
type FieldMemory interface {
	RecordFieldSuggestions(ctx context.Context, entries map[string][]string) error
}

type TicketRepository interface {
	Create(ctx context.Context, t *Ticket) error
	GetByID(ctx context.Context, id string) (*TicketResponse, error)
	List(ctx context.Context, params ListTicketsParams) ([]TicketResponse, string, bool, error)
	CountOpen(ctx context.Context) (int, error)
	UpdateStatus(ctx context.Context, id string, status string, resolvedBy *string) error
	AddStatusHistory(ctx context.Context, event *TicketStatusHistoryInsert) error
	GetStatusHistory(ctx context.Context, ticketID string) ([]TicketStatusEvent, error)
}

type TicketService interface {
	CreateTicket(ctx context.Context, req *CreateTicketRequest, userID string) (*TicketResponse, error)
	// GetTicket enforces the ownership rule: the reporter or a Super Admin —
	// callers pass the requester's id and whether they're a Super Admin.
	GetTicket(ctx context.Context, id string, requesterID string, isSuperAdmin bool) (*TicketResponse, error)
	ListMyTickets(ctx context.Context, userID string, params ListTicketsParams) (*TicketListPage, error)
	ListAllTickets(ctx context.Context, params ListTicketsParams) (*TicketListPage, error)
	UpdateStatus(ctx context.Context, id string, req *UpdateTicketStatusRequest, actorID string) error
	GetStatusHistory(ctx context.Context, id string, requesterID string, isSuperAdmin bool) ([]TicketStatusEvent, error)
	CountOpen(ctx context.Context) (int, error)
}
