package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/bid/domain"
)

// fakeBidRepo implements domain.BidRepository with just enough behavior for
// UpdateBid's Internal-Approval-readiness and ownership-reassignment
// branches: a fixed GetByID result, and Update/AddMember/RemoveMember calls
// recorded (not applied) so a test can assert on what UpdateBid attempted to
// persist. Every other method only needs to exist to satisfy the interface.
type fakeBidRepo struct {
	bid *domain.BidWorkspace

	lastUpdate    *domain.UpdateBidRequest
	addedMembers  []memberCall
	removedMembers []string

	lastFieldSuggestions map[string][]string
	addedHistory         []*domain.BidStageHistory
}

type memberCall struct {
	userID string
	role   string
}

func (f *fakeBidRepo) Create(ctx context.Context, params *domain.CreateBidParams) (string, error) {
	return "", nil
}
func (f *fakeBidRepo) GetByID(ctx context.Context, id string) (*domain.BidWorkspace, error) {
	return f.bid, nil
}
func (f *fakeBidRepo) FindByIdentifier(ctx context.Context, identifier string, excludeID string) (*domain.IdentifierMatch, error) {
	return nil, nil
}
func (f *fakeBidRepo) List(ctx context.Context, params domain.ListBidsParams) ([]domain.BidWorkspace, int, map[string]int, error) {
	return nil, 0, nil, nil
}
func (f *fakeBidRepo) Update(ctx context.Context, id string, req *domain.UpdateBidRequest) error {
	f.lastUpdate = req
	return nil
}
func (f *fakeBidRepo) UpdateStage(ctx context.Context, id string, stage string, status string) error {
	return nil
}
func (f *fakeBidRepo) UpdateOutcome(ctx context.Context, id string, req *domain.RecordOutcomeRequest) error {
	return nil
}
func (f *fakeBidRepo) SoftDelete(ctx context.Context, id string) error      { return nil }
func (f *fakeBidRepo) Restore(ctx context.Context, id string) error         { return nil }
func (f *fakeBidRepo) PermanentDelete(ctx context.Context, id string) error { return nil }
func (f *fakeBidRepo) CleanupExpired(ctx context.Context) error             { return nil }
func (f *fakeBidRepo) AddMember(ctx context.Context, bidID, userID, role, addedBy string) error {
	f.addedMembers = append(f.addedMembers, memberCall{userID: userID, role: role})
	return nil
}
func (f *fakeBidRepo) RemoveMember(ctx context.Context, bidID, userID string) error {
	f.removedMembers = append(f.removedMembers, userID)
	return nil
}
func (f *fakeBidRepo) GetMembers(ctx context.Context, bidID string) ([]domain.MemberResponse, error) {
	return nil, nil
}
func (f *fakeBidRepo) AddStageHistory(ctx context.Context, history *domain.BidStageHistory) error {
	f.addedHistory = append(f.addedHistory, history)
	return nil
}
func (f *fakeBidRepo) GetStageHistory(ctx context.Context, bidID string, q domain.AuditLogQuery) ([]domain.StageHistoryResponse, string, bool, error) {
	return nil, "", false, nil
}
func (f *fakeBidRepo) GetGlobalAuditLogs(ctx context.Context, q domain.AuditLogQuery, userID string) ([]domain.GlobalAuditItem, string, bool, error) {
	return nil, "", false, nil
}
func (f *fakeBidRepo) GetTenderPerformanceMatrix(ctx context.Context, ownerID string) ([]domain.TenderOwnerPerformanceStat, error) {
	return nil, nil
}
func (f *fakeBidRepo) GetUserSummary(ctx context.Context, userID string) (*domain.UserSummary, error) {
	return &domain.UserSummary{ID: userID}, nil
}
func (f *fakeBidRepo) BulkInsertChecklists(ctx context.Context, bidID string, titles []string) error {
	return nil
}
func (f *fakeBidRepo) BulkInsertChecklistsWithGroup(ctx context.Context, bidID string, titles []string, group string) error {
	return nil
}
func (f *fakeBidRepo) GetChecklists(ctx context.Context, bidID string) ([]domain.BidChecklist, error) {
	return nil, nil
}
func (f *fakeBidRepo) GetChecklistsByGroup(ctx context.Context, bidID string, group string) ([]domain.BidChecklist, error) {
	return nil, nil
}
func (f *fakeBidRepo) AddChecklist(ctx context.Context, bidID string, title string, sortOrder int) (*domain.BidChecklist, error) {
	return nil, nil
}
func (f *fakeBidRepo) AddChecklistWithGroup(ctx context.Context, bidID string, title string, sortOrder int, group string) (*domain.BidChecklist, error) {
	return nil, nil
}
func (f *fakeBidRepo) UpdateChecklist(ctx context.Context, checklistID string, title *string, sortOrder *int) error {
	return nil
}
func (f *fakeBidRepo) DeleteChecklist(ctx context.Context, checklistID string) error { return nil }
func (f *fakeBidRepo) ReorderChecklists(ctx context.Context, items []domain.ReorderChecklistItem) error {
	return nil
}
func (f *fakeBidRepo) ToggleChecklist(ctx context.Context, checklistID string, isDone bool, doneBy string) error {
	return nil
}
func (f *fakeBidRepo) RecordFieldSuggestions(ctx context.Context, entries map[string][]string) error {
	f.lastFieldSuggestions = entries
	return nil
}
func (f *fakeBidRepo) ListFieldSuggestions(ctx context.Context, fieldKey string, limit int) ([]domain.FieldSuggestion, error) {
	return nil, nil
}

// fakeAlertSvc records every alert CreateAlert was called with, so the test
// can assert on what was (or wasn't) sent.
type fakeAlertSvc struct {
	created []*alertDomain.Alert
}

func (f *fakeAlertSvc) CreateAlert(ctx context.Context, alert *alertDomain.Alert) error {
	f.created = append(f.created, alert)
	return nil
}
func (f *fakeAlertSvc) SendNotificationEmail(ctx context.Context, alert *alertDomain.Alert) error {
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

func hasAlertType(alerts []*alertDomain.Alert, alertType string) bool {
	for _, a := range alerts {
		if a.Type == alertType {
			return true
		}
	}
	return false
}

// TestUpdateBid_InternalApprovalReadyAlert covers the auto-notify branch
// added to UpdateBid: completing Document Checklist Preparation on a tender
// where EMD isn't required must alert the Account Manager that Internal
// Approval is ready; completing it while EMD is still required must not.
func TestUpdateBid_InternalApprovalReadyAlert(t *testing.T) {
	amID := "am-user-1"

	newBid := func(emdExempted, emdNotApplicable bool) *domain.BidWorkspace {
		b := &domain.BidWorkspace{
			ID:               "bid-1",
			Title:            "Test Tender",
			WorkflowStage:    domain.StageDocumentChecklistPrep,
			CreationMode:     domain.CreationModeManual,
			BidOwnerID:       "owner-1",
			AccountManagerID: &amID,
			EMDExempted:      emdExempted,
			EMDNotApplicable: emdNotApplicable,
			EMDType:          strPtr("ONLINE"),
			// No prior stage_completions — this update is the first time
			// DOCUMENT_CHECKLIST_PREPARATION is marked complete.
			StageCompletions: []byte(`{}`),
		}
		if emdExempted {
			b.EMDExemptionType = strPtr("MSME")
		} else if !emdNotApplicable {
			// EMD actually required (Online mode) — satisfy validateEMDDetails.
			b.EMDBankName = strPtr("Test Bank")
			b.EMDAccountNumber = strPtr("1234567890")
			b.EMDIFSCCode = strPtr("TEST0001234")
		}
		return b
	}

	t.Run("EMD exempted + checklist just completed fires the alert", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(true, false)}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts)

		req := &domain.UpdateBidRequest{
			StageCompletions: map[string]bool{domain.StageDocumentChecklistPrep: true},
		}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
		if !hasAlertType(alerts.created, "INTERNAL_APPROVAL_READY") {
			t.Fatalf("expected an INTERNAL_APPROVAL_READY alert, got: %+v", alerts.created)
		}
		for _, a := range alerts.created {
			if a.Type == "INTERNAL_APPROVAL_READY" && (a.UserID == nil || *a.UserID != amID) {
				t.Fatalf("INTERNAL_APPROVAL_READY alert should target the Account Manager (%s), got %+v", amID, a.UserID)
			}
		}
	})

	t.Run("EMD not applicable + checklist just completed fires the alert", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(false, true)}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts)

		req := &domain.UpdateBidRequest{
			StageCompletions: map[string]bool{domain.StageDocumentChecklistPrep: true},
		}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
		if !hasAlertType(alerts.created, "INTERNAL_APPROVAL_READY") {
			t.Fatalf("expected an INTERNAL_APPROVAL_READY alert, got: %+v", alerts.created)
		}
	})

	t.Run("EMD still required — no alert on checklist completion", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(false, false)}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts)

		req := &domain.UpdateBidRequest{
			StageCompletions: map[string]bool{domain.StageDocumentChecklistPrep: true},
		}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
		if hasAlertType(alerts.created, "INTERNAL_APPROVAL_READY") {
			t.Fatalf("did not expect an INTERNAL_APPROVAL_READY alert when EMD is still required, got: %+v", alerts.created)
		}
	})

	t.Run("already complete before this update — no repeat alert", func(t *testing.T) {
		b := newBid(true, false)
		b.StageCompletions = []byte(`{"DOCUMENT_CHECKLIST_PREPARATION":true}`)
		repo := &fakeBidRepo{bid: b}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts)

		// Re-saving the same completed state (e.g. an unrelated field edit)
		// must not re-fire the notification.
		req := &domain.UpdateBidRequest{
			StageCompletions: map[string]bool{domain.StageDocumentChecklistPrep: true},
		}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
		if hasAlertType(alerts.created, "INTERNAL_APPROVAL_READY") {
			t.Fatalf("did not expect a repeat INTERNAL_APPROVAL_READY alert, got: %+v", alerts.created)
		}
	})
}

// TestUpdateBid_OwnerReassignment covers the fix for the "owner reassignment
// shows success but nothing actually changes" bug: UpdateBidRequest silently
// had no BidOwnerID field at all, so the column, the Members tab, and the
// new-owner alert never updated. It also covers the two new rules that ride
// along with the fix: only this tender's Account Manager / Reporting Manager
// (or an admin) may reassign the owner, and the Account Manager can never be
// assigned as the owner they're reviewing.
func TestUpdateBid_OwnerReassignment(t *testing.T) {
	amID := "am-user-1"
	rmID := "rm-user-1"
	ownerID := "owner-1"

	newBid := func() *domain.BidWorkspace {
		return &domain.BidWorkspace{
			ID:                 "bid-1",
			Title:              "Test Tender",
			WorkflowStage:      domain.StageDiscovered,
			CreationMode:       domain.CreationModeManual,
			BidOwnerID:         ownerID,
			AccountManagerID:   strPtr(amID),
			ReportingManagerID: strPtr(rmID),
			EMDNotApplicable:   true,
			StageCompletions:   []byte(`{}`),
		}
	}

	t.Run("tender's Account Manager can reassign the owner", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts)

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, amID, nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
		if repo.lastUpdate == nil || repo.lastUpdate.BidOwnerID == nil || *repo.lastUpdate.BidOwnerID != "new-owner-1" {
			t.Fatalf("expected bid_owner_id to reach repo.Update, got: %+v", repo.lastUpdate)
		}
		if !hasAlertType(alerts.created, "TENDER_OWNERSHIP_CHANGED") {
			t.Fatalf("expected a TENDER_OWNERSHIP_CHANGED alert, got: %+v", alerts.created)
		}
		for _, a := range alerts.created {
			if a.Type == "TENDER_OWNERSHIP_CHANGED" && (a.UserID == nil || *a.UserID != "new-owner-1") {
				t.Fatalf("ownership alert should target the new owner, got %+v", a.UserID)
			}
		}
		foundNewOwnerMember := false
		for _, m := range repo.addedMembers {
			if m.userID == "new-owner-1" && m.role == "OWNER" {
				foundNewOwnerMember = true
			}
		}
		if !foundNewOwnerMember {
			t.Fatalf("expected the new owner to be added as an OWNER member, got: %+v", repo.addedMembers)
		}
		foundOldOwnerRemoved := false
		for _, uid := range repo.removedMembers {
			if uid == ownerID {
				foundOldOwnerRemoved = true
			}
		}
		if !foundOldOwnerRemoved {
			t.Fatalf("expected the previous owner's membership row to be removed, got: %+v", repo.removedMembers)
		}
	})

	t.Run("tender's Reporting Manager can reassign the owner", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, rmID, nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
	})

	t.Run("an unrelated bid.edit holder cannot reassign the owner", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		err := svc.UpdateBid(context.Background(), "bid-1", req, "some-other-user", []string{"BID_EXECUTIVE"})
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})

	t.Run("the outgoing owner cannot reassign themself out", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		err := svc.UpdateBid(context.Background(), "bid-1", req, ownerID, nil)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})

	t.Run("SUPER_ADMIN can override and reassign the owner", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		err := svc.UpdateBid(context.Background(), "bid-1", req, "admin-1", []string{"SUPER_ADMIN"})
		if err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
	})

	t.Run("cannot assign the tender's Account Manager as the new owner", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr(amID)}
		err := svc.UpdateBid(context.Background(), "bid-1", req, amID, nil)
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation, got: %v", err)
		}
	})

	t.Run("re-submitting the same owner id is not a reassignment", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})

		// Sent by someone who isn't the tender's AM/RM — must not be blocked,
		// since nothing is actually changing.
		req := &domain.UpdateBidRequest{BidOwnerID: strPtr(ownerID)}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, "some-other-user", nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
	})
}

func strPtr(s string) *string { return &s }

// TestExtractOEMNames covers the JSON-parsing edge cases Field Memory relies
// on: OEM values pulled out of requested_products must survive blank OEMs,
// whitespace-only OEMs, and malformed JSON (which must yield no names, not
// an error that could block saving the tender).
func TestExtractOEMNames(t *testing.T) {
	cases := []struct {
		name string
		json string
		want []string
	}{
		{
			name: "extracts oem from each product row",
			json: `[{"product":"Firewall","oem":"Fortinet"},{"product":"Switch","oem":"Cisco"}]`,
			want: []string{"Fortinet", "Cisco"},
		},
		{
			name: "skips rows with a blank or whitespace-only oem",
			json: `[{"product":"Firewall","oem":""},{"product":"Switch","oem":"   "},{"product":"AP","oem":"Aruba"}]`,
			want: []string{"Aruba"},
		},
		{
			name: "malformed JSON yields no names, not an error",
			json: `not-json`,
			want: nil,
		},
		{
			name: "empty array yields no names",
			json: `[]`,
			want: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := extractOEMNames(tc.json)
			if len(got) != len(tc.want) {
				t.Fatalf("extractOEMNames(%q) = %v, want %v", tc.json, got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("extractOEMNames(%q)[%d] = %q, want %q", tc.json, i, got[i], tc.want[i])
				}
			}
		})
	}
}

// TestFieldSuggestionEntries covers the map-building step: nil and blank
// fields must be skipped so RecordFieldSuggestions never writes empty rows.
func TestFieldSuggestionEntries(t *testing.T) {
	products := `[{"product":"Firewall","oem":"Fortinet"}]`
	blank := "   "

	entries := fieldSuggestionEntries(
		strPtr("Bharat Electronics Ltd"),
		nil,          // department_name omitted entirely
		&blank,       // location present but blank
		strPtr("SBI"),
		nil,
		nil,
		&products,
	)

	want := map[string][]string{
		"organization_name": {"Bharat Electronics Ltd"},
		"emd_bank_name":      {"SBI"},
		"oem":                {"Fortinet"},
	}
	if len(entries) != len(want) {
		t.Fatalf("fieldSuggestionEntries() = %+v, want %+v", entries, want)
	}
	for key, vals := range want {
		got, ok := entries[key]
		if !ok || len(got) != len(vals) || got[0] != vals[0] {
			t.Fatalf("fieldSuggestionEntries()[%q] = %v, want %v", key, got, vals)
		}
	}
	if _, present := entries["department_name"]; present {
		t.Fatalf("expected nil department_name to be skipped, got entry: %v", entries["department_name"])
	}
	if _, present := entries["location"]; present {
		t.Fatalf("expected blank location to be skipped, got entry: %v", entries["location"])
	}
}

// TestUpdateBid_RecordsFieldSuggestions covers the write hook itself: a
// successful UpdateBid must feed Field Memory with whatever free-text fields
// were actually present on the request.
func TestUpdateBid_RecordsFieldSuggestions(t *testing.T) {
	bid := &domain.BidWorkspace{
		ID:               "bid-1",
		Title:            "Test Tender",
		WorkflowStage:    domain.StageDiscovered,
		CreationMode:     domain.CreationModeManual,
		BidOwnerID:       "owner-1",
		AccountManagerID: strPtr("am-1"),
		EMDNotApplicable: true,
		StageCompletions: []byte(`{}`),
	}
	repo := &fakeBidRepo{bid: bid}
	svc := NewBidService(repo, &fakeAlertSvc{})

	products := `[{"product":"Firewall","oem":"Fortinet"}]`
	req := &domain.UpdateBidRequest{
		OrganizationName:  strPtr("Bharat Electronics Ltd"),
		Location:          strPtr("New Delhi"),
		RequestedProducts: &products,
	}
	if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
		t.Fatalf("UpdateBid: %v", err)
	}

	if repo.lastFieldSuggestions == nil {
		t.Fatalf("expected RecordFieldSuggestions to be called")
	}
	if got := repo.lastFieldSuggestions["organization_name"]; len(got) != 1 || got[0] != "Bharat Electronics Ltd" {
		t.Fatalf("organization_name entries = %v", got)
	}
	if got := repo.lastFieldSuggestions["location"]; len(got) != 1 || got[0] != "New Delhi" {
		t.Fatalf("location entries = %v", got)
	}
	if got := repo.lastFieldSuggestions["oem"]; len(got) != 1 || got[0] != "Fortinet" {
		t.Fatalf("oem entries = %v", got)
	}
}

// TestUpdateBid_NoFieldSuggestionsWhenNothingFreeTextChanges covers the
// opposite path: an update touching none of the Field Memory fields (e.g.
// only a stage transition) must not call RecordFieldSuggestions at all.
func TestUpdateBid_NoFieldSuggestionsWhenNothingFreeTextChanges(t *testing.T) {
	bid := &domain.BidWorkspace{
		ID:               "bid-1",
		Title:            "Test Tender",
		WorkflowStage:    domain.StageDiscovered,
		CreationMode:     domain.CreationModeManual,
		BidOwnerID:       "owner-1",
		AccountManagerID: strPtr("am-1"),
		EMDNotApplicable: true,
		StageCompletions: []byte(`{}`),
	}
	repo := &fakeBidRepo{bid: bid}
	svc := NewBidService(repo, &fakeAlertSvc{})

	req := &domain.UpdateBidRequest{Remarks: strPtr("internal note only")}
	if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
		t.Fatalf("UpdateBid: %v", err)
	}
	if repo.lastFieldSuggestions != nil {
		t.Fatalf("expected RecordFieldSuggestions not to be called, got: %v", repo.lastFieldSuggestions)
	}
}

// ────────────────────────────────────────
// Action Ledger
// ────────────────────────────────────────

// TestDiffBidFields is a pure unit test of the diffing logic every
// TENDER_EDITED entry is built from: a field absent from the request must
// never appear (PATCH semantics — nil means "not part of this update", not
// "clear it"), and a field present but unchanged must not appear either, so
// the resulting audit entry only ever lists what actually changed.
func TestDiffBidFields(t *testing.T) {
	bid := &domain.BidWorkspace{
		Title:            "Old Title",
		OrganizationName: strPtr("Old Org"),
		EstimatedValue:   floatPtr(100000),
		Quantity:         intPtr(5),
		BidOwnerID:       "owner-1",
	}

	t.Run("changed fields are captured with old and new values", func(t *testing.T) {
		req := &domain.UpdateBidRequest{
			Title:            strPtr("New Title"),
			OrganizationName: strPtr("New Org"),
			EstimatedValue:   floatPtr(150000),
		}
		diffs := diffBidFields(bid, req)
		want := map[string][2]string{
			"title":             {"Old Title", "New Title"},
			"organization_name": {"Old Org", "New Org"},
			"estimated_value":   {"100000", "150000"},
		}
		if len(diffs) != len(want) {
			t.Fatalf("diffBidFields() = %+v, want %d entries", diffs, len(want))
		}
		for _, d := range diffs {
			exp, ok := want[d.Field]
			if !ok || d.Old != exp[0] || d.New != exp[1] {
				t.Fatalf("unexpected diff entry %+v", d)
			}
		}
	})

	t.Run("a field absent from the request produces no diff", func(t *testing.T) {
		req := &domain.UpdateBidRequest{Remarks: strPtr("unrelated note")}
		diffs := diffBidFields(bid, req)
		for _, d := range diffs {
			if d.Field == "title" || d.Field == "organization_name" || d.Field == "estimated_value" {
				t.Fatalf("expected untouched field %q to be absent, got %+v", d.Field, diffs)
			}
		}
	})

	t.Run("a field present but unchanged produces no diff", func(t *testing.T) {
		req := &domain.UpdateBidRequest{
			Title:    strPtr("Old Title"), // identical to bid.Title
			Quantity: intPtr(5),           // identical to bid.Quantity
		}
		diffs := diffBidFields(bid, req)
		if len(diffs) != 0 {
			t.Fatalf("expected no diffs for unchanged values, got %+v", diffs)
		}
	})
}

func newLedgerTestBid() *domain.BidWorkspace {
	return &domain.BidWorkspace{
		ID:               "bid-1",
		Title:            "Test Tender",
		WorkflowStage:    domain.StageDiscovered,
		CreationMode:     domain.CreationModeManual,
		BidOwnerID:       "owner-1",
		AccountManagerID: strPtr("am-1"),
		EMDNotApplicable: true,
		StageCompletions: []byte(`{}`),
	}
}

func lastEventType(repo *fakeBidRepo) string {
	if len(repo.addedHistory) == 0 {
		return ""
	}
	h := repo.addedHistory[len(repo.addedHistory)-1]
	if h.EventType == nil {
		return ""
	}
	return *h.EventType
}

// TestUpdateBid_LogsFieldEdits covers the write hook that closes the "editing
// a tender leaves no trace" gap: a save that changes a curated field must
// write one TENDER_EDITED entry carrying the diff, with the tender's title
// denormalized onto it (so it survives even if the tender is later deleted).
func TestUpdateBid_LogsFieldEdits(t *testing.T) {
	repo := &fakeBidRepo{bid: newLedgerTestBid()}
	svc := NewBidService(repo, &fakeAlertSvc{})

	req := &domain.UpdateBidRequest{Location: strPtr("New Delhi")}
	if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
		t.Fatalf("UpdateBid: %v", err)
	}

	if lastEventType(repo) != "TENDER_EDITED" {
		t.Fatalf("expected a TENDER_EDITED entry, got history: %+v", repo.addedHistory)
	}
	last := repo.addedHistory[len(repo.addedHistory)-1]
	if last.BidTitle != "Test Tender" {
		t.Fatalf("expected bid_title to be denormalized onto the entry, got %q", last.BidTitle)
	}
	if last.TransitionedBy != "actor-1" {
		t.Fatalf("expected actor-1 as the entry's actor, got %q", last.TransitionedBy)
	}
	var diffs []domain.FieldDiff
	if err := json.Unmarshal(last.Details, &diffs); err != nil {
		t.Fatalf("details did not unmarshal as []FieldDiff: %v", err)
	}
	if len(diffs) != 1 || diffs[0].Field != "location" || diffs[0].New != "New Delhi" {
		t.Fatalf("unexpected diff payload: %+v", diffs)
	}
}

// TestArchiveRestoreDeleteBid_LogActions covers the three destructive
// actions that were previously completely silent — none of them even
// accepted an actor id before this change.
func TestArchiveRestoreDeleteBid_LogActions(t *testing.T) {
	t.Run("ArchiveBid logs TENDER_ARCHIVED", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newLedgerTestBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})
		if err := svc.ArchiveBid(context.Background(), "bid-1", "actor-1"); err != nil {
			t.Fatalf("ArchiveBid: %v", err)
		}
		if lastEventType(repo) != "TENDER_ARCHIVED" {
			t.Fatalf("expected TENDER_ARCHIVED, got history: %+v", repo.addedHistory)
		}
	})

	t.Run("RestoreBid logs TENDER_RESTORED", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newLedgerTestBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})
		if err := svc.RestoreBid(context.Background(), "bid-1", "actor-1"); err != nil {
			t.Fatalf("RestoreBid: %v", err)
		}
		if lastEventType(repo) != "TENDER_RESTORED" {
			t.Fatalf("expected TENDER_RESTORED, got history: %+v", repo.addedHistory)
		}
	})

	t.Run("PermanentDeleteBid logs TENDER_DELETED before deleting", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newLedgerTestBid()}
		svc := NewBidService(repo, &fakeAlertSvc{})
		if err := svc.PermanentDeleteBid(context.Background(), "bid-1", "actor-1"); err != nil {
			t.Fatalf("PermanentDeleteBid: %v", err)
		}
		if lastEventType(repo) != "TENDER_DELETED" {
			t.Fatalf("expected TENDER_DELETED, got history: %+v", repo.addedHistory)
		}
		last := repo.addedHistory[len(repo.addedHistory)-1]
		if last.BidTitle != "Test Tender" {
			t.Fatalf("expected bid_title captured before delete, got %q", last.BidTitle)
		}
	})
}

// TestRecordOutcome_LogsAction covers the outcome-recording path.
func TestRecordOutcome_LogsAction(t *testing.T) {
	repo := &fakeBidRepo{bid: newLedgerTestBid()}
	svc := NewBidService(repo, &fakeAlertSvc{})

	req := &domain.RecordOutcomeRequest{BidOutcome: "WON"}
	if err := svc.RecordOutcome(context.Background(), "bid-1", req, "actor-1"); err != nil {
		t.Fatalf("RecordOutcome: %v", err)
	}
	if lastEventType(repo) != "OUTCOME_RECORDED" {
		t.Fatalf("expected OUTCOME_RECORDED, got history: %+v", repo.addedHistory)
	}
}

// TestAddRemoveMember_LogActions covers team membership changes.
func TestAddRemoveMember_LogActions(t *testing.T) {
	repo := &fakeBidRepo{bid: newLedgerTestBid()}
	svc := NewBidService(repo, &fakeAlertSvc{})

	if err := svc.AddMember(context.Background(), "bid-1", &domain.AddMemberRequest{UserID: "member-1", Role: "MEMBER"}, "actor-1"); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	if lastEventType(repo) != "MEMBER_ADDED" {
		t.Fatalf("expected MEMBER_ADDED, got history: %+v", repo.addedHistory)
	}

	if err := svc.RemoveMember(context.Background(), "bid-1", "member-1", "actor-1"); err != nil {
		t.Fatalf("RemoveMember: %v", err)
	}
	if lastEventType(repo) != "MEMBER_REMOVED" {
		t.Fatalf("expected MEMBER_REMOVED, got history: %+v", repo.addedHistory)
	}
}

func floatPtr(f float64) *float64 { return &f }
func intPtr(i int) *int           { return &i }
