package service

import (
	"context"
	"errors"
	"strconv"
	"testing"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/feedback/domain"
)

// fakeTicketRepo implements domain.TicketRepository entirely in memory —
// enough behavior for the service tests below, nothing more.
type fakeTicketRepo struct {
	tickets map[string]*domain.TicketResponse
	nextID  int

	lastCreated      *domain.Ticket
	lastHistory      []*domain.TicketStatusHistoryInsert
	lastUpdateStatus string
}

func newFakeTicketRepo() *fakeTicketRepo {
	return &fakeTicketRepo{tickets: map[string]*domain.TicketResponse{}}
}

func (f *fakeTicketRepo) Create(ctx context.Context, t *domain.Ticket) error {
	f.nextID++
	t.ID = "ticket-" + strconv.Itoa(f.nextID)
	f.lastCreated = t
	f.tickets[t.ID] = &domain.TicketResponse{
		ID: t.ID, Category: t.Category, CustomCategory: t.CustomCategory,
		Description: t.Description, Status: t.Status,
		Reporter: domain.UserSummary{ID: t.UserID, FullName: "Test User", Username: "testuser"},
	}
	return nil
}

func (f *fakeTicketRepo) GetByID(ctx context.Context, id string) (*domain.TicketResponse, error) {
	t, ok := f.tickets[id]
	if !ok {
		return nil, errors.New("not found")
	}
	cp := *t
	return &cp, nil
}

func (f *fakeTicketRepo) List(ctx context.Context, params domain.ListTicketsParams) ([]domain.TicketResponse, string, bool, error) {
	var out []domain.TicketResponse
	for _, t := range f.tickets {
		if params.UserID != "" && t.Reporter.ID != params.UserID {
			continue
		}
		out = append(out, *t)
	}
	return out, "", false, nil
}

func (f *fakeTicketRepo) CountOpen(ctx context.Context) (int, error) {
	n := 0
	for _, t := range f.tickets {
		if t.Status != domain.StatusResolved {
			n++
		}
	}
	return n, nil
}

func (f *fakeTicketRepo) UpdateStatus(ctx context.Context, id string, status string, resolvedBy *string) error {
	f.lastUpdateStatus = status
	t, ok := f.tickets[id]
	if !ok {
		return errors.New("not found")
	}
	t.Status = status
	if status == domain.StatusResolved && resolvedBy != nil {
		t.ResolvedBy = &domain.UserSummary{ID: *resolvedBy}
	} else {
		t.ResolvedBy = nil
	}
	return nil
}

func (f *fakeTicketRepo) AddStatusHistory(ctx context.Context, event *domain.TicketStatusHistoryInsert) error {
	f.lastHistory = append(f.lastHistory, event)
	return nil
}

func (f *fakeTicketRepo) GetStatusHistory(ctx context.Context, ticketID string) ([]domain.TicketStatusEvent, error) {
	var out []domain.TicketStatusEvent
	for _, h := range f.lastHistory {
		if h.TicketID != ticketID {
			continue
		}
		out = append(out, domain.TicketStatusEvent{FromStatus: h.FromStatus, ToStatus: h.ToStatus})
	}
	return out, nil
}

// fakeAlertSvc records every alert CreateAlert/SendNotificationEmail was
// called with, in separate lists.
type fakeAlertSvc struct {
	created []*alertDomain.Alert
	emailed []*alertDomain.Alert
}

func (f *fakeAlertSvc) CreateAlert(ctx context.Context, alert *alertDomain.Alert) error {
	f.created = append(f.created, alert)
	return nil
}

// SendNotificationEmail is what Feedback Loop actually calls (email-only,
// no in-app alert row — see the interface doc comment on why) — tracked
// separately from CreateAlert so a test can assert the in-app inbox was
// never touched.
func (f *fakeAlertSvc) SendNotificationEmail(ctx context.Context, alert *alertDomain.Alert) error {
	f.emailed = append(f.emailed, alert)
	return nil
}
func (f *fakeAlertSvc) GetUserAlerts(ctx context.Context, userID, userRole string) ([]alertDomain.Alert, error) {
	return nil, nil
}
func (f *fakeAlertSvc) MarkAsRead(ctx context.Context, alertID, userID string) error { return nil }
func (f *fakeAlertSvc) MarkAllAsRead(ctx context.Context, userID, userRole string) error {
	return nil
}
func (f *fakeAlertSvc) DeleteAlert(ctx context.Context, alertID, userID, userRole string) error {
	return nil
}

// fakeFieldMemory records every RecordFieldSuggestions call.
type fakeFieldMemory struct {
	lastEntries map[string][]string
}

func (f *fakeFieldMemory) RecordFieldSuggestions(ctx context.Context, entries map[string][]string) error {
	f.lastEntries = entries
	return nil
}

func TestCreateTicket_Validation(t *testing.T) {
	t.Run("category is required", func(t *testing.T) {
		svc := NewTicketService(newFakeTicketRepo(), &fakeAlertSvc{}, &fakeFieldMemory{})
		_, err := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{Description: "x"}, "user-1")
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}
	})

	t.Run("description is required", func(t *testing.T) {
		svc := NewTicketService(newFakeTicketRepo(), &fakeAlertSvc{}, &fakeFieldMemory{})
		_, err := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{Category: "Bug Report"}, "user-1")
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}
	})

	t.Run("Other category requires custom_category", func(t *testing.T) {
		svc := NewTicketService(newFakeTicketRepo(), &fakeAlertSvc{}, &fakeFieldMemory{})
		_, err := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{Category: "Other", Description: "x"}, "user-1")
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}
	})
}

// TestCreateTicket_NotifiesAndRemembers covers the two integration points:
// the Super Admin broadcast alert (in-app + email in one call) and Field
// Memory recording a custom "Other" category for future suggestion.
func TestCreateTicket_NotifiesAndRemembers(t *testing.T) {
	repo := newFakeTicketRepo()
	alerts := &fakeAlertSvc{}
	fields := &fakeFieldMemory{}
	svc := NewTicketService(repo, alerts, fields)

	custom := "Notification Preferences"
	ticket, err := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{
		Category:       "Other",
		CustomCategory: &custom,
		Description:    "Would like a digest email instead of one per alert",
	}, "user-1")
	if err != nil {
		t.Fatalf("CreateTicket: %v", err)
	}
	if ticket.Status != domain.StatusOpen {
		t.Fatalf("expected new ticket to be OPEN, got %s", ticket.Status)
	}

	// Email-only: the Tickets badge is the in-app signal, so this must never
	// write a row into the general Alerts inbox (CreateAlert untouched).
	if len(alerts.created) != 0 {
		t.Fatalf("expected no in-app alert row, got %d", len(alerts.created))
	}
	if len(alerts.emailed) != 1 {
		t.Fatalf("expected exactly one notification email, got %d", len(alerts.emailed))
	}
	if alerts.emailed[0].TargetRole != "SUPER_ADMIN" {
		t.Fatalf("expected email broadcast to SUPER_ADMIN, got target_role=%q", alerts.emailed[0].TargetRole)
	}
	if alerts.emailed[0].Type != "FEEDBACK_SUBMITTED" {
		t.Fatalf("expected FEEDBACK_SUBMITTED email type, got %q", alerts.emailed[0].Type)
	}

	got := fields.lastEntries["ticket_category_other"]
	if len(got) != 1 || got[0] != custom {
		t.Fatalf("expected custom category %q remembered via Field Memory, got %v", custom, got)
	}
}

// TestCreateTicket_StandardCategoryDoesNotTouchFieldMemory covers the
// opposite path: choosing a fixed category (not Other) must never write to
// Field Memory — there's no custom text to remember.
func TestCreateTicket_StandardCategoryDoesNotTouchFieldMemory(t *testing.T) {
	repo := newFakeTicketRepo()
	fields := &fakeFieldMemory{}
	svc := NewTicketService(repo, &fakeAlertSvc{}, fields)

	_, err := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{
		Category:    "Bug Report",
		Description: "Save button does nothing on the Pricing tab",
	}, "user-1")
	if err != nil {
		t.Fatalf("CreateTicket: %v", err)
	}
	if fields.lastEntries != nil {
		t.Fatalf("expected Field Memory untouched for a standard category, got %v", fields.lastEntries)
	}
}

func TestGetTicket_OwnershipEnforced(t *testing.T) {
	repo := newFakeTicketRepo()
	svc := NewTicketService(repo, &fakeAlertSvc{}, &fakeFieldMemory{})

	ticket, err := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{
		Category: "Bug Report", Description: "x",
	}, "owner-1")
	if err != nil {
		t.Fatalf("CreateTicket: %v", err)
	}

	t.Run("owner can view their own ticket", func(t *testing.T) {
		if _, err := svc.GetTicket(context.Background(), ticket.ID, "owner-1", false); err != nil {
			t.Fatalf("expected owner to view their ticket, got: %v", err)
		}
	})
	t.Run("Super Admin can view any ticket", func(t *testing.T) {
		if _, err := svc.GetTicket(context.Background(), ticket.ID, "someone-else", true); err != nil {
			t.Fatalf("expected Super Admin to view any ticket, got: %v", err)
		}
	})
	t.Run("a different non-admin user is forbidden", func(t *testing.T) {
		_, err := svc.GetTicket(context.Background(), ticket.ID, "someone-else", false)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})
}

// TestUpdateStatus_LogsAndNotifiesOnResolve covers the status lifecycle:
// a real transition writes history and, only on RESOLVED, notifies the
// reporter back.
func TestUpdateStatus_LogsAndNotifiesOnResolve(t *testing.T) {
	repo := newFakeTicketRepo()
	alerts := &fakeAlertSvc{}
	svc := NewTicketService(repo, alerts, &fakeFieldMemory{})

	ticket, _ := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{
		Category: "Bug Report", Description: "x",
	}, "reporter-1")
	// CreateTicket itself already fired the SUPER_ADMIN submission email —
	// that's the baseline every assertion below counts from.
	afterCreateEmailCount := len(alerts.emailed)

	if err := svc.UpdateStatus(context.Background(), ticket.ID, &domain.UpdateTicketStatusRequest{Status: domain.StatusInProgress}, "admin-1"); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}
	if len(repo.lastHistory) != 1 || repo.lastHistory[0].ToStatus != domain.StatusInProgress {
		t.Fatalf("expected one history entry to IN_PROGRESS, got %+v", repo.lastHistory)
	}
	if len(alerts.emailed) != afterCreateEmailCount {
		t.Fatalf("expected no new notification on IN_PROGRESS, got %d new", len(alerts.emailed)-afterCreateEmailCount)
	}

	if err := svc.UpdateStatus(context.Background(), ticket.ID, &domain.UpdateTicketStatusRequest{Status: domain.StatusResolved}, "admin-1"); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}
	if len(repo.lastHistory) != 2 || repo.lastHistory[1].ToStatus != domain.StatusResolved {
		t.Fatalf("expected a second history entry to RESOLVED, got %+v", repo.lastHistory)
	}
	// Never touches the in-app Alerts inbox — email only, both times.
	if len(alerts.created) != 0 {
		t.Fatalf("expected no in-app alert rows at all, got %d", len(alerts.created))
	}
	resolveEmail := alerts.emailed[len(alerts.emailed)-1]
	if len(alerts.emailed) != afterCreateEmailCount+1 || resolveEmail.Type != "FEEDBACK_RESOLVED" {
		t.Fatalf("expected exactly one new FEEDBACK_RESOLVED email to the reporter, got %+v", alerts.emailed)
	}
	if resolveEmail.UserID == nil || *resolveEmail.UserID != "reporter-1" {
		t.Fatalf("expected the resolve email addressed to the reporter, got %+v", resolveEmail.UserID)
	}
}

func TestUpdateStatus_RejectsUnknownStatus(t *testing.T) {
	repo := newFakeTicketRepo()
	svc := NewTicketService(repo, &fakeAlertSvc{}, &fakeFieldMemory{})
	ticket, _ := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{Category: "Bug Report", Description: "x"}, "user-1")

	err := svc.UpdateStatus(context.Background(), ticket.ID, &domain.UpdateTicketStatusRequest{Status: "CLOSED_FOREVER"}, "admin-1")
	if !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected ErrValidation for an unknown status, got %v", err)
	}
}

// TestUpdateStatus_SameStatusIsANoOp covers resubmitting the same status —
// must not write a spurious history entry.
func TestUpdateStatus_SameStatusIsANoOp(t *testing.T) {
	repo := newFakeTicketRepo()
	svc := NewTicketService(repo, &fakeAlertSvc{}, &fakeFieldMemory{})
	ticket, _ := svc.CreateTicket(context.Background(), &domain.CreateTicketRequest{Category: "Bug Report", Description: "x"}, "user-1")

	if err := svc.UpdateStatus(context.Background(), ticket.ID, &domain.UpdateTicketStatusRequest{Status: domain.StatusOpen}, "admin-1"); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}
	if len(repo.lastHistory) != 0 {
		t.Fatalf("expected no history entry for a same-status resubmission, got %+v", repo.lastHistory)
	}
}
