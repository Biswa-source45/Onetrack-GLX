package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/onetrack/backend/internal/bid/domain"
)

// In-memory contacts for the shared fakeBidRepo.
func (f *fakeBidRepo) ListContacts(ctx context.Context, bidID string) ([]domain.TenderContact, error) {
	return append([]domain.TenderContact{}, f.contacts...), nil
}
func (f *fakeBidRepo) GetContact(ctx context.Context, bidID, id string) (*domain.TenderContact, error) {
	for i := range f.contacts {
		if f.contacts[i].ID == id {
			c := f.contacts[i]
			return &c, nil
		}
	}
	return nil, pgx.ErrNoRows
}
func (f *fakeBidRepo) CreateContact(ctx context.Context, c *domain.TenderContact, actorID string) (*domain.TenderContact, error) {
	out := *c
	out.ID = fmt.Sprintf("c-%d", len(f.contacts)+1)
	out.SortOrder = len(f.contacts) + 1
	f.contacts = append(f.contacts, out)
	return &out, nil
}
func (f *fakeBidRepo) UpdateContact(ctx context.Context, c *domain.TenderContact) error {
	for i := range f.contacts {
		if f.contacts[i].ID == c.ID {
			f.contacts[i] = *c
			return nil
		}
	}
	return pgx.ErrNoRows
}
func (f *fakeBidRepo) DeleteContact(ctx context.Context, bidID, id string) error {
	for i := range f.contacts {
		if f.contacts[i].ID == id {
			f.contacts = append(f.contacts[:i], f.contacts[i+1:]...)
			return nil
		}
	}
	return pgx.ErrNoRows
}
func (f *fakeBidRepo) ReorderContacts(ctx context.Context, bidID string, items []domain.ReorderContactItem) error {
	for _, it := range items {
		found := false
		for i := range f.contacts {
			if f.contacts[i].ID == it.ID {
				f.contacts[i].Kind, f.contacts[i].SortOrder, found = it.Kind, it.SortOrder, true
			}
		}
		if !found {
			return pgx.ErrNoRows
		}
	}
	return nil
}

func contactSvc() (*bidService, *fakeBidRepo) {
	repo := &fakeBidRepo{bid: &domain.BidWorkspace{ID: "bid-1", Title: "T"}}
	return NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{}).(*bidService), repo
}

func add(t *testing.T, s *bidService, req domain.SaveContactRequest) (*domain.TenderContact, error) {
	t.Helper()
	return s.AddContact(context.Background(), "bid-1", &req, "actor-1")
}

func TestContactValidation(t *testing.T) {
	s, _ := contactSvc()
	bad := map[string]domain.SaveContactRequest{
		"no name":       {Kind: "OEM", Name: "  "},
		"bad kind":      {Kind: "FRIEND", Name: "Asha"},
		"bad email":     {Kind: "OEM", Name: "Asha", Email: "asha"},
		"short phone":   {Kind: "OEM", Name: "Asha", Phone: "12345"},
		"unknown src":   {Kind: "OEM", Name: "Asha", Source: "WEB"},
		"oem auth w/o":  {Kind: "OEM", Name: "Asha", Source: "OEM_AUTH"},
		"oem auth cust": {Kind: "CUSTOMER", Name: "Asha", Source: "OEM_AUTH", SourceRef: "r1"},
	}
	for name, req := range bad {
		if _, err := add(t, s, req); !errors.Is(err, domain.ErrValidation) {
			t.Errorf("%s: want ErrValidation, got %v", name, err)
		}
	}
	c, err := add(t, s, domain.SaveContactRequest{Kind: "oem", Name: " Asha Rao ", Email: " ASHA@Dell.com ", Phone: "+91 98765 43210", Source: "OEM_AUTH", SourceRef: "r1"})
	if err != nil {
		t.Fatalf("valid contact: %v", err)
	}
	if c.Kind != "OEM" || c.Name != "Asha Rao" || c.Email != "asha@dell.com" {
		t.Errorf("not normalised: %+v", c)
	}
}

func TestContactDuplicatesAreRefusedAndNamed(t *testing.T) {
	s, _ := contactSvc()
	if _, err := add(t, s, domain.SaveContactRequest{Kind: "CUSTOMER", Name: "Ravi", Email: "ravi@cust.in", Phone: "+91 98765 43210"}); err != nil {
		t.Fatal(err)
	}
	for name, req := range map[string]domain.SaveContactRequest{
		"same email, other case":      {Kind: "OEM", Name: "Someone", Email: "RAVI@cust.in"},
		"same phone, other form":      {Kind: "BIDDER", Name: "Someone", Phone: "91-98765-43210"},
		"same phone, no country code": {Kind: "OTHER", Name: "Someone", Phone: "98765 43210"},
	} {
		_, err := add(t, s, req)
		if !errors.Is(err, domain.ErrConflict) {
			t.Fatalf("%s: want ErrConflict, got %v", name, err)
		}
		if got := err.Error(); !strings.Contains(got, "Ravi") || !strings.Contains(got, "Customer") {
			t.Errorf("%s: message should name the existing contact and its type, got %q", name, got)
		}
	}
	// Contacts with neither email nor phone are not duplicates of each other.
	if _, err := add(t, s, domain.SaveContactRequest{Kind: "OTHER", Name: "Front desk"}); err != nil {
		t.Fatal(err)
	}
	if _, err := add(t, s, domain.SaveContactRequest{Kind: "OTHER", Name: "Reception"}); err != nil {
		t.Fatalf("two contacts without email/phone must be allowed: %v", err)
	}
}

func yes() *bool { b := true; return &b }
func no() *bool  { b := false; return &b }

func TestContactBanNeedsAReasonAndUnbanClearsIt(t *testing.T) {
	s, repo := contactSvc()
	c, _ := add(t, s, domain.SaveContactRequest{Kind: "OEM", Name: "Asha", Email: "a@x.in"})
	ctx := context.Background()

	if _, err := s.UpdateContact(ctx, "bid-1", c.ID, &domain.UpdateContactRequest{Banned: yes()}, "u"); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("ban without a reason: want ErrValidation, got %v", err)
	}
	out, err := s.UpdateContact(ctx, "bid-1", c.ID, &domain.UpdateContactRequest{Banned: yes(), BannedReason: strPtr(" left the company ")}, "u")
	if err != nil || !out.Banned || out.BannedReason != "left the company" {
		t.Fatalf("ban: %+v %v", out, err)
	}
	out, err = s.UpdateContact(ctx, "bid-1", c.ID, &domain.UpdateContactRequest{Banned: no()}, "u")
	if err != nil || out.Banned || out.BannedReason != "" {
		t.Fatalf("unban must clear the reason: %+v %v", out, err)
	}
	var events []string
	for _, h := range repo.addedHistory {
		events = append(events, *h.EventType)
	}
	want := []string{"CONTACT_ADDED", "CONTACT_BANNED", "CONTACT_UNBANNED"}
	if fmt.Sprint(events) != fmt.Sprint(want) {
		t.Errorf("history = %v, want %v", events, want)
	}
}

func TestContactUpdateKeepsOwnEmailButNotAnotherOnes(t *testing.T) {
	s, _ := contactSvc()
	a, _ := add(t, s, domain.SaveContactRequest{Kind: "OEM", Name: "A", Email: "a@x.in"})
	b, _ := add(t, s, domain.SaveContactRequest{Kind: "OEM", Name: "B", Email: "b@x.in"})
	ctx := context.Background()
	if _, err := s.UpdateContact(ctx, "bid-1", a.ID, &domain.UpdateContactRequest{Email: strPtr("a@x.in"), Notes: strPtr("n")}, "u"); err != nil {
		t.Fatalf("saving a contact with its own email: %v", err)
	}
	if _, err := s.UpdateContact(ctx, "bid-1", b.ID, &domain.UpdateContactRequest{Email: strPtr("A@x.in")}, "u"); !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("taking someone else's email: want ErrConflict, got %v", err)
	}
	if _, err := s.UpdateContact(ctx, "bid-1", "missing", &domain.UpdateContactRequest{Notes: strPtr("n")}, "u"); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("unknown contact: want ErrNoRows, got %v", err)
	}
}

func TestContactMoveReorderAndDelete(t *testing.T) {
	s, repo := contactSvc()
	a, _ := add(t, s, domain.SaveContactRequest{Kind: "OEM", Name: "A", Email: "a@x.in"})
	b, _ := add(t, s, domain.SaveContactRequest{Kind: "OEM", Name: "B", Email: "b@x.in"})
	ctx := context.Background()

	bad := []domain.ReorderContactItem{{ID: a.ID, Kind: "OEM", SortOrder: 1}, {ID: a.ID, Kind: "OEM", SortOrder: 2}}
	if _, err := s.ReorderContacts(ctx, "bid-1", &domain.ReorderContactsRequest{Items: bad}, "u"); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("same id twice: want ErrValidation, got %v", err)
	}
	if _, err := s.ReorderContacts(ctx, "bid-1", &domain.ReorderContactsRequest{Items: []domain.ReorderContactItem{{ID: a.ID, Kind: "NOPE", SortOrder: 1}}}, "u"); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("bad kind: want ErrValidation, got %v", err)
	}
	if _, err := s.ReorderContacts(ctx, "bid-1", &domain.ReorderContactsRequest{}, "u"); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("empty: want ErrValidation, got %v", err)
	}
	// Drag A to Customer (first), B stays first in OEM: only A's move is logged.
	out, err := s.ReorderContacts(ctx, "bid-1", &domain.ReorderContactsRequest{Items: []domain.ReorderContactItem{
		{ID: a.ID, Kind: "customer", SortOrder: 1}, {ID: b.ID, Kind: "OEM", SortOrder: 1}}}, "u")
	if err != nil {
		t.Fatal(err)
	}
	if out[0].Kind != "CUSTOMER" || out[1].Kind != "OEM" {
		t.Errorf("stored order wrong: %+v", out)
	}
	moves := 0
	for _, h := range repo.addedHistory {
		if *h.EventType == "CONTACT_MOVED" {
			moves++
		}
	}
	if moves != 1 {
		t.Errorf("moves logged = %d, want 1", moves)
	}
	if err := s.DeleteContact(ctx, "bid-1", a.ID, "u"); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteContact(ctx, "bid-1", a.ID, "u"); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("deleting twice: want ErrNoRows, got %v", err)
	}
}
