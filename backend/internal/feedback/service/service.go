package service

import (
	"context"
	"fmt"
	"strings"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/feedback/domain"
)

type ticketService struct {
	repo     domain.TicketRepository
	alertSvc alertDomain.AlertService
	fields   domain.FieldMemory
}

func NewTicketService(repo domain.TicketRepository, alertSvc alertDomain.AlertService, fields domain.FieldMemory) domain.TicketService {
	return &ticketService{repo: repo, alertSvc: alertSvc, fields: fields}
}

func (s *ticketService) CreateTicket(ctx context.Context, req *domain.CreateTicketRequest, userID string) (*domain.TicketResponse, error) {
	category := strings.TrimSpace(req.Category)
	description := strings.TrimSpace(req.Description)
	if category == "" {
		return nil, fmt.Errorf("%w: category is required", domain.ErrValidation)
	}
	if description == "" {
		return nil, fmt.Errorf("%w: description is required", domain.ErrValidation)
	}

	var customCategory *string
	if category == "Other" {
		custom := ""
		if req.CustomCategory != nil {
			custom = strings.TrimSpace(*req.CustomCategory)
		}
		if custom == "" {
			return nil, fmt.Errorf("%w: describe the category when choosing Other", domain.ErrValidation)
		}
		customCategory = &custom
	}

	t := &domain.Ticket{
		UserID:         userID,
		Category:       category,
		CustomCategory: customCategory,
		Description:    description,
		Status:         domain.StatusOpen,
	}
	if err := s.repo.Create(ctx, t); err != nil {
		return nil, fmt.Errorf("create ticket: %w", err)
	}

	// Field Memory: a custom "Other" category gets remembered and suggested
	// next time, the same way any other free-text field does. Best-effort —
	// never blocks ticket creation.
	if customCategory != nil && s.fields != nil {
		_ = s.fields.RecordFieldSuggestions(ctx, map[string][]string{"ticket_category_other": {*customCategory}})
	}

	// Email every Super Admin — the Tickets tab's own badge is the in-app
	// signal, so this only sends the email side (SendNotificationEmail),
	// not a duplicate row in the general Alerts inbox.
	if s.alertSvc != nil {
		displayCategory := category
		if customCategory != nil {
			displayCategory = *customCategory
		}
		_ = s.alertSvc.SendNotificationEmail(ctx, &alertDomain.Alert{
			TargetRole: "SUPER_ADMIN",
			CreatedBy:  &userID,
			Type:       "FEEDBACK_SUBMITTED",
			Title:      fmt.Sprintf("New feedback: %s", displayCategory),
			Message:    description,
		})
	}

	return s.repo.GetByID(ctx, t.ID)
}

func (s *ticketService) GetTicket(ctx context.Context, id string, requesterID string, isSuperAdmin bool) (*domain.TicketResponse, error) {
	t, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !isSuperAdmin && t.Reporter.ID != requesterID {
		return nil, domain.ErrForbidden
	}
	return t, nil
}

func (s *ticketService) ListMyTickets(ctx context.Context, userID string, params domain.ListTicketsParams) (*domain.TicketListPage, error) {
	params.UserID = userID
	return s.listPage(ctx, params)
}

func (s *ticketService) ListAllTickets(ctx context.Context, params domain.ListTicketsParams) (*domain.TicketListPage, error) {
	params.UserID = ""
	return s.listPage(ctx, params)
}

func (s *ticketService) listPage(ctx context.Context, params domain.ListTicketsParams) (*domain.TicketListPage, error) {
	items, nextCursor, hasMore, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, err
	}
	return &domain.TicketListPage{Items: items, NextCursor: nextCursor, HasMore: hasMore}, nil
}

func (s *ticketService) UpdateStatus(ctx context.Context, id string, req *domain.UpdateTicketStatusRequest, actorID string) error {
	status := strings.TrimSpace(req.Status)
	if !domain.ValidStatuses[status] {
		return fmt.Errorf("%w: unknown status %q", domain.ErrValidation, status)
	}

	ticket, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if ticket.Status == status {
		return nil // no-op resubmission of the same status — nothing to log
	}
	fromStatus := ticket.Status

	var resolvedBy *string
	if status == domain.StatusResolved {
		resolvedBy = &actorID
	}
	if err := s.repo.UpdateStatus(ctx, id, status, resolvedBy); err != nil {
		return fmt.Errorf("update ticket status: %w", err)
	}

	_ = s.repo.AddStatusHistory(ctx, &domain.TicketStatusHistoryInsert{
		TicketID:   id,
		FromStatus: &fromStatus,
		ToStatus:   status,
		ChangedBy:  actorID,
		Note:       req.Note,
	})

	// Email the reporter back when their ticket is resolved — their own "My
	// Tickets" status is the in-app signal, so again email-only.
	if status == domain.StatusResolved && s.alertSvc != nil {
		reporterID := ticket.Reporter.ID
		_ = s.alertSvc.SendNotificationEmail(ctx, &alertDomain.Alert{
			UserID:    &reporterID,
			CreatedBy: &actorID,
			Type:      "FEEDBACK_RESOLVED",
			Title:     "Your feedback was resolved",
			Message:   ticket.Description,
		})
	}

	return nil
}

func (s *ticketService) GetStatusHistory(ctx context.Context, id string, requesterID string, isSuperAdmin bool) ([]domain.TicketStatusEvent, error) {
	ticket, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !isSuperAdmin && ticket.Reporter.ID != requesterID {
		return nil, domain.ErrForbidden
	}
	return s.repo.GetStatusHistory(ctx, id)
}

func (s *ticketService) CountOpen(ctx context.Context) (int, error) {
	return s.repo.CountOpen(ctx)
}
