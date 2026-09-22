package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"testing"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/bid/domain"
	systemlogDomain "github.com/onetrack/backend/internal/systemlog/domain"
)

// fakeBidRepo implements domain.BidRepository with just enough behavior for
// UpdateBid's Internal-Approval-readiness and ownership-reassignment
// branches: a fixed GetByID result, and Update/AddMember/RemoveMember calls
// recorded (not applied) so a test can assert on what UpdateBid attempted to
// persist. Every other method only needs to exist to satisfy the interface.
type fakeBidRepo struct {
	bid *domain.BidWorkspace

	lastUpdate     *domain.UpdateBidRequest
	addedMembers   []memberCall
	removedMembers []string

	lastFieldSuggestions map[string][]string
	addedHistory         []*domain.BidStageHistory

	stageRestrictions map[string][]string // userID -> restricted stages
	userSummaries     map[string]*domain.UserSummary

	pendingEdits  map[string]*domain.TenderEditApproval // editID -> edit
	nextPendingID int

	lastOutcome      *domain.RecordOutcomeRequest
	softDeleted      bool
	permanentDeleted bool

	pricingCandidates []domain.PricingWorkspaceRow
	pricingWindow     int
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
	f.lastOutcome = req
	return nil
}
func (f *fakeBidRepo) SoftDelete(ctx context.Context, id string) error {
	f.softDeleted = true
	return nil
}
func (f *fakeBidRepo) Restore(ctx context.Context, id string) error { return nil }
func (f *fakeBidRepo) PermanentDelete(ctx context.Context, id string) error {
	f.permanentDeleted = true
	return nil
}
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
	if u, ok := f.userSummaries[userID]; ok {
		return u, nil
	}
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
func (f *fakeBidRepo) GetStageRestrictions(ctx context.Context, userID string) ([]string, error) {
	if f.stageRestrictions == nil {
		return nil, nil
	}
	return f.stageRestrictions[userID], nil
}
func (f *fakeBidRepo) SetStageRestrictions(ctx context.Context, userID string, stages []string, restrictedBy string) error {
	if f.stageRestrictions == nil {
		f.stageRestrictions = map[string][]string{}
	}
	f.stageRestrictions[userID] = stages
	return nil
}
func (f *fakeBidRepo) CreatePendingEdit(ctx context.Context, edit *domain.TenderEditApproval) error {
	if f.pendingEdits == nil {
		f.pendingEdits = map[string]*domain.TenderEditApproval{}
	}
	f.nextPendingID++
	edit.ID = "pending-" + string(rune('0'+f.nextPendingID))
	f.pendingEdits[edit.ID] = edit
	return nil
}
func (f *fakeBidRepo) GetPendingEditByID(ctx context.Context, editID string) (*domain.TenderEditApproval, error) {
	return f.pendingEdits[editID], nil
}
func (f *fakeBidRepo) GetPendingEditForBid(ctx context.Context, bidID string) (*domain.TenderEditApproval, error) {
	for _, e := range f.pendingEdits {
		if e.BidID == bidID && e.Status == domain.EditApprovalPending {
			return e, nil
		}
	}
	return nil, nil
}
func (f *fakeBidRepo) GetPricingWorkspaceCandidates(ctx context.Context) ([]domain.PricingWorkspaceRow, error) {
	return f.pricingCandidates, nil
}
func (f *fakeBidRepo) GetPricingSuggestionWindow(ctx context.Context) (int, error) {
	if f.pricingWindow > 0 {
		return f.pricingWindow, nil
	}
	return 5, nil
}
func (f *fakeBidRepo) DecidePendingEdit(ctx context.Context, editID string, status string, decidedPayload []byte, decisionDiff []domain.FieldDiff, comment string, decidedBy string) error {
	e := f.pendingEdits[editID]
	if e == nil {
		return errors.New("not found")
	}
	e.Status = status
	e.DecidedPayload = decidedPayload
	e.DecisionDiff = decisionDiff
	if comment != "" {
		e.DecisionComment = &comment
	}
	e.DecidedBy = &domain.UserSummary{ID: decidedBy}
	return nil
}

// fakeSystemLog is a no-op Recorder — tests that don't assert on System
// Logs just need NewBidService's third argument satisfied.
type fakeSystemLog struct {
	recorded []string // eventType, for tests that do care
}

func (f *fakeSystemLog) Record(ctx context.Context, category, eventType, actorID string, targetUserID *string, summary string, details interface{}) {
	f.recorded = append(f.recorded, eventType)
}

var _ systemlogDomain.Recorder = (*fakeSystemLog)(nil)

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
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

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
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

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
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

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
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

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
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

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
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, rmID, nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
	})

	t.Run("an unrelated bid.edit holder cannot reassign the owner", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		err := svc.UpdateBid(context.Background(), "bid-1", req, "some-other-user", []string{"BID_EXECUTIVE"})
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})

	t.Run("the outgoing owner cannot reassign themself out", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		err := svc.UpdateBid(context.Background(), "bid-1", req, ownerID, nil)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})

	t.Run("SUPER_ADMIN can override and reassign the owner", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr("new-owner-1")}
		err := svc.UpdateBid(context.Background(), "bid-1", req, "admin-1", []string{"SUPER_ADMIN"})
		if err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
	})

	t.Run("cannot assign the tender's Account Manager as the new owner", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{BidOwnerID: strPtr(amID)}
		err := svc.UpdateBid(context.Background(), "bid-1", req, amID, nil)
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation, got: %v", err)
		}
	})

	t.Run("re-submitting the same owner id is not a reassignment", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		// Sent by someone who isn't the tender's AM/RM — must not be blocked,
		// since nothing is actually changing.
		req := &domain.UpdateBidRequest{BidOwnerID: strPtr(ownerID)}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, "some-other-user", nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
	})
}

func strPtr(s string) *string { return &s }

// TestExtractProductFields covers the JSON-parsing edge cases Field Memory
// relies on: OEM and product-name values pulled out of requested_products
// must survive blank values, whitespace-only values, and malformed JSON
// (which must yield no names, not an error that could block saving the
// tender).
func TestExtractProductFields(t *testing.T) {
	cases := []struct {
		name         string
		json         string
		wantOEMs     []string
		wantProducts []string
	}{
		{
			name:         "extracts oem and product from each row",
			json:         `[{"product":"Firewall","oem":"Fortinet"},{"product":"Switch","oem":"Cisco"}]`,
			wantOEMs:     []string{"Fortinet", "Cisco"},
			wantProducts: []string{"Firewall", "Switch"},
		},
		{
			name:         "skips rows with a blank or whitespace-only value",
			json:         `[{"product":"Firewall","oem":""},{"product":"   ","oem":"Aruba"}]`,
			wantOEMs:     []string{"Aruba"},
			wantProducts: []string{"Firewall"},
		},
		{
			name:         "malformed JSON yields no names, not an error",
			json:         `not-json`,
			wantOEMs:     nil,
			wantProducts: nil,
		},
		{
			name:         "empty array yields no names",
			json:         `[]`,
			wantOEMs:     nil,
			wantProducts: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotOEMs, gotProducts := extractProductFields(tc.json)
			if len(gotOEMs) != len(tc.wantOEMs) {
				t.Fatalf("extractProductFields(%q) oems = %v, want %v", tc.json, gotOEMs, tc.wantOEMs)
			}
			for i := range gotOEMs {
				if gotOEMs[i] != tc.wantOEMs[i] {
					t.Fatalf("extractProductFields(%q) oems[%d] = %q, want %q", tc.json, i, gotOEMs[i], tc.wantOEMs[i])
				}
			}
			if len(gotProducts) != len(tc.wantProducts) {
				t.Fatalf("extractProductFields(%q) products = %v, want %v", tc.json, gotProducts, tc.wantProducts)
			}
			for i := range gotProducts {
				if gotProducts[i] != tc.wantProducts[i] {
					t.Fatalf("extractProductFields(%q) products[%d] = %q, want %q", tc.json, i, gotProducts[i], tc.wantProducts[i])
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
		strPtr("Firewall Procurement"), // title
		strPtr("Bharat Electronics Ltd"),
		nil,             // department_name omitted entirely
		&blank,          // location present but blank
		strPtr("GeM"),   // portal_source
		strPtr("Cloud"), // category
		nil,             // scope_type omitted entirely
		strPtr("SBI"),
		nil,
		nil,
		&products,
	)

	want := map[string][]string{
		"title":             {"Firewall Procurement"},
		"organization_name": {"Bharat Electronics Ltd"},
		"portal_source":     {"GeM"},
		"category":          {"Cloud"},
		"emd_bank_name":     {"SBI"},
		"oem":               {"Fortinet"},
		"product":           {"Firewall"},
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
	svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

	products := `[{"product":"Firewall","oem":"Fortinet"}]`
	req := &domain.UpdateBidRequest{
		Title:             strPtr("Firewall Procurement for HQ"),
		OrganizationName:  strPtr("Bharat Electronics Ltd"),
		Location:          strPtr("New Delhi"),
		PortalSource:      strPtr("GeM"),
		Category:          strPtr("Security"),
		ScopeType:         strPtr("Supply"),
		RequestedProducts: &products,
	}
	if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
		t.Fatalf("UpdateBid: %v", err)
	}

	if repo.lastFieldSuggestions == nil {
		t.Fatalf("expected RecordFieldSuggestions to be called")
	}
	checks := map[string]string{
		"title":             "Firewall Procurement for HQ",
		"organization_name": "Bharat Electronics Ltd",
		"location":          "New Delhi",
		"portal_source":     "GeM",
		"category":          "Security",
		"scope_type":        "Supply",
		"oem":               "Fortinet",
		"product":           "Firewall",
	}
	for key, want := range checks {
		if got := repo.lastFieldSuggestions[key]; len(got) != 1 || got[0] != want {
			t.Fatalf("%s entries = %v, want [%q]", key, got, want)
		}
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
	svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

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
	svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

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
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})
		if err := svc.ArchiveBid(context.Background(), "bid-1", "actor-1", nil); err != nil {
			t.Fatalf("ArchiveBid: %v", err)
		}
		if lastEventType(repo) != "TENDER_ARCHIVED" {
			t.Fatalf("expected TENDER_ARCHIVED, got history: %+v", repo.addedHistory)
		}
	})

	t.Run("RestoreBid logs TENDER_RESTORED", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newLedgerTestBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})
		if err := svc.RestoreBid(context.Background(), "bid-1", "actor-1"); err != nil {
			t.Fatalf("RestoreBid: %v", err)
		}
		if lastEventType(repo) != "TENDER_RESTORED" {
			t.Fatalf("expected TENDER_RESTORED, got history: %+v", repo.addedHistory)
		}
	})

	t.Run("PermanentDeleteBid logs TENDER_DELETED before deleting", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newLedgerTestBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})
		if err := svc.PermanentDeleteBid(context.Background(), "bid-1", "actor-1", nil); err != nil {
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
	svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

	req := &domain.RecordOutcomeRequest{BidOutcome: "WON"}
	if err := svc.RecordOutcome(context.Background(), "bid-1", req, "actor-1", nil); err != nil {
		t.Fatalf("RecordOutcome: %v", err)
	}
	if lastEventType(repo) != "OUTCOME_RECORDED" {
		t.Fatalf("expected OUTCOME_RECORDED, got history: %+v", repo.addedHistory)
	}
}

// TestAddRemoveMember_LogActions covers team membership changes.
func TestAddRemoveMember_LogActions(t *testing.T) {
	repo := &fakeBidRepo{bid: newLedgerTestBid()}
	svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

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

// TestStageAccessControl covers the three enforcement points a restricted
// Bid Executive must be blocked from — editing, transitioning, and
// recording an outcome — plus that an unrestricted actor is unaffected.
func TestStageAccessControl(t *testing.T) {
	newBid := func() *domain.BidWorkspace {
		return &domain.BidWorkspace{
			ID:            "bid-1",
			Title:         "Test Tender",
			WorkflowStage: domain.StageTechnicalEvaluation,
			CreationMode:  domain.CreationModeManual,
			BidOwnerID:    "exec-1",
		}
	}

	t.Run("UpdateBid is blocked while the tender sits in a restricted stage", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(), stageRestrictions: map[string][]string{
			"exec-1": {domain.StageTechnicalEvaluation},
		}}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		err := svc.UpdateBid(context.Background(), "bid-1", &domain.UpdateBidRequest{Remarks: strPtr("trying to edit")}, "exec-1", nil)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
		if repo.lastUpdate != nil {
			t.Fatalf("Update should never have reached the repo, got: %+v", repo.lastUpdate)
		}
	})

	t.Run("UpdateBid succeeds for an actor with no restrictions", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		if err := svc.UpdateBid(context.Background(), "bid-1", &domain.UpdateBidRequest{Remarks: strPtr("fine")}, "exec-1", nil); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
	})

	t.Run("TransitionStage is blocked leaving a restricted current stage", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(), stageRestrictions: map[string][]string{
			"exec-1": {domain.StageTechnicalEvaluation},
		}}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		_, err := svc.TransitionStage(context.Background(), "bid-1", &domain.TransitionStageRequest{TargetStage: domain.StageFinancialEvaluation}, "exec-1", nil)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})

	t.Run("TransitionStage is blocked entering a restricted target stage", func(t *testing.T) {
		bid := newBid()
		bid.WorkflowStage = domain.StageGeMSubmission
		repo := &fakeBidRepo{bid: bid, stageRestrictions: map[string][]string{
			"exec-1": {domain.StageTechnicalEvaluation},
		}}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		_, err := svc.TransitionStage(context.Background(), "bid-1", &domain.TransitionStageRequest{TargetStage: domain.StageTechnicalEvaluation}, "exec-1", nil)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})

	t.Run("RecordOutcome is blocked while the tender sits in a restricted stage", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(), stageRestrictions: map[string][]string{
			"exec-1": {domain.StageTechnicalEvaluation},
		}}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		err := svc.RecordOutcome(context.Background(), "bid-1", &domain.RecordOutcomeRequest{BidOutcome: "WON"}, "exec-1", nil)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})
}

// TestSetStageRestrictions covers the write side's validation: only a Bid
// Executive can be restricted, only real stage keys are accepted, and a
// successful call is recorded to System Logs.
func TestSetStageRestrictions(t *testing.T) {
	t.Run("rejects a target who isn't a Bid Executive", func(t *testing.T) {
		repo := &fakeBidRepo{bid: &domain.BidWorkspace{}}
		repo.userSummaries = map[string]*domain.UserSummary{
			"manager-1": {ID: "manager-1", FullName: "A Manager", Role: "MANAGER"},
		}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		err := svc.SetStageRestrictions(context.Background(), "manager-1", []string{domain.StageTechnicalEvaluation}, "admin-1")
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation, got: %v", err)
		}
	})

	t.Run("rejects an unknown stage key", func(t *testing.T) {
		repo := &fakeBidRepo{bid: &domain.BidWorkspace{}}
		repo.userSummaries = map[string]*domain.UserSummary{
			"exec-1": {ID: "exec-1", FullName: "An Executive", Role: "BID_EXECUTIVE"},
		}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		err := svc.SetStageRestrictions(context.Background(), "exec-1", []string{"NOT_A_REAL_STAGE"}, "admin-1")
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation, got: %v", err)
		}
	})

	t.Run("restricts a Bid Executive and logs the change", func(t *testing.T) {
		repo := &fakeBidRepo{bid: &domain.BidWorkspace{}}
		repo.userSummaries = map[string]*domain.UserSummary{
			"exec-1": {ID: "exec-1", FullName: "An Executive", Role: "BID_EXECUTIVE"},
		}
		sysLog := &fakeSystemLog{}
		svc := NewBidService(repo, &fakeAlertSvc{}, sysLog)

		stages := []string{domain.StageTechnicalEvaluation, domain.StageFinancialEvaluation, domain.StageAwardHandover}
		if err := svc.SetStageRestrictions(context.Background(), "exec-1", stages, "admin-1"); err != nil {
			t.Fatalf("SetStageRestrictions: %v", err)
		}
		got, err := svc.GetStageRestrictions(context.Background(), "exec-1")
		if err != nil {
			t.Fatalf("GetStageRestrictions: %v", err)
		}
		if len(got) != 3 {
			t.Fatalf("expected 3 restricted stages, got %v", got)
		}
		if len(sysLog.recorded) != 1 || sysLog.recorded[0] != "STAGE_ACCESS_UPDATED" {
			t.Fatalf("expected a STAGE_ACCESS_UPDATED system log entry, got: %v", sysLog.recorded)
		}
	})
}

// TestUpdateBid_EditApproval covers the Reporting-Manager-approval gate on
// a Bid Executive's Edit-Tender-form submission (req.FullEditSubmission):
// held instead of applied, the RM can approve as-is, correct it, or reject
// it, and the executive is notified either way.
func TestUpdateBid_EditApproval(t *testing.T) {
	rmID := "rm-user-1"
	execID := "exec-user-1"

	newBid := func(rm *string) *domain.BidWorkspace {
		return &domain.BidWorkspace{
			ID:                 "bid-1",
			Title:              "Test Tender",
			WorkflowStage:      domain.StageDiscovered,
			CreationMode:       domain.CreationModeManual,
			BidOwnerID:         execID,
			ReportingManagerID: rm,
			EstimatedValue:     floatPtr(100000),
			EMDNotApplicable:   true,
			StageCompletions:   []byte(`{}`),
		}
	}

	t.Run("executive's full-edit submission is held, not applied", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(strPtr(rmID))}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(150000)}
		err := svc.UpdateBid(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"})

		var pae *domain.PendingApprovalError
		if !errors.As(err, &pae) {
			t.Fatalf("expected a PendingApprovalError, got: %v", err)
		}
		if repo.lastUpdate != nil {
			t.Fatalf("expected the change NOT to reach repo.Update while pending, got: %+v", repo.lastUpdate)
		}
		if !hasAlertType(alerts.created, "TENDER_EDIT_PENDING_APPROVAL") {
			t.Fatalf("expected a TENDER_EDIT_PENDING_APPROVAL alert to the RM, got: %+v", alerts.created)
		}
		for _, a := range alerts.created {
			if a.Type == "TENDER_EDIT_PENDING_APPROVAL" && (a.UserID == nil || *a.UserID != rmID) {
				t.Fatalf("pending-approval alert should target the Reporting Manager, got %+v", a.UserID)
			}
		}
	})

	t.Run("Account Manager / Manager / Admin edits bypass the gate", func(t *testing.T) {
		for _, roles := range [][]string{{"ACCOUNT_MANAGER"}, {"MANAGER"}, {"SUPER_ADMIN"}} {
			repo := &fakeBidRepo{bid: newBid(strPtr(rmID))}
			svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

			req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(150000)}
			if err := svc.UpdateBid(context.Background(), "bid-1", req, "actor-1", roles); err != nil {
				t.Fatalf("roles=%v UpdateBid: %v", roles, err)
			}
			if repo.lastUpdate == nil {
				t.Fatalf("roles=%v expected the edit to apply immediately", roles)
			}
		}
	})

	t.Run("no Reporting Manager assigned — applies immediately", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(nil)}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(150000)}
		if err := svc.UpdateBid(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"}); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
		if repo.lastUpdate == nil {
			t.Fatalf("expected the edit to apply immediately with no Reporting Manager to route to")
		}
	})

	t.Run("no actual change — applies immediately, nothing held", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(strPtr(rmID))}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(100000)} // same as current
		if err := svc.UpdateBid(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"}); err != nil {
			t.Fatalf("UpdateBid: %v", err)
		}
		if repo.lastUpdate == nil {
			t.Fatalf("expected a no-op edit to apply directly instead of being held for approval")
		}
	})

	t.Run("a second edit while one is pending is rejected", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(strPtr(rmID))}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(150000)}
		_ = svc.UpdateBid(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"})

		req2 := &domain.UpdateBidRequest{FullEditSubmission: true, Category: strPtr("IT Hardware")}
		err := svc.UpdateBid(context.Background(), "bid-1", req2, execID, []string{"BID_EXECUTIVE"})
		if !errors.Is(err, domain.ErrEditAlreadyPending) {
			t.Fatalf("expected ErrEditAlreadyPending, got: %v", err)
		}
	})

	t.Run("Reporting Manager approves as-is", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(strPtr(rmID))}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(150000)}
		var pae *domain.PendingApprovalError
		errors.As(svc.UpdateBid(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"}), &pae)

		approveReq := &domain.UpdateBidRequest{EstimatedValue: floatPtr(150000)}
		if err := svc.ApprovePendingEdit(context.Background(), pae.EditID, approveReq, "", rmID, []string{"MANAGER"}); err != nil {
			t.Fatalf("ApprovePendingEdit: %v", err)
		}
		if repo.lastUpdate == nil || repo.lastUpdate.EstimatedValue == nil || *repo.lastUpdate.EstimatedValue != 150000 {
			t.Fatalf("expected the approved value to reach repo.Update, got: %+v", repo.lastUpdate)
		}
		if !hasAlertType(alerts.created, "TENDER_EDIT_APPROVED") {
			t.Fatalf("expected a TENDER_EDIT_APPROVED alert to the executive, got: %+v", alerts.created)
		}
		for _, a := range alerts.created {
			if a.Type == "TENDER_EDIT_APPROVED" && (a.UserID == nil || *a.UserID != execID) {
				t.Fatalf("approval alert should target the requesting executive, got %+v", a.UserID)
			}
		}
		edit := repo.pendingEdits[pae.EditID]
		if edit.Status != domain.EditApprovalApproved {
			t.Fatalf("expected edit status APPROVED, got %s", edit.Status)
		}
		if len(edit.DecisionDiff) != 0 {
			t.Fatalf("expected no correction diff when approving as-is, got: %+v", edit.DecisionDiff)
		}
	})

	t.Run("Reporting Manager corrects a value before approving", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(strPtr(rmID))}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(150000)}
		var pae *domain.PendingApprovalError
		errors.As(svc.UpdateBid(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"}), &pae)

		// RM corrects the proposed value down to 140000 before approving.
		approveReq := &domain.UpdateBidRequest{EstimatedValue: floatPtr(140000)}
		if err := svc.ApprovePendingEdit(context.Background(), pae.EditID, approveReq, "adjusted the value", rmID, []string{"MANAGER"}); err != nil {
			t.Fatalf("ApprovePendingEdit: %v", err)
		}
		if repo.lastUpdate == nil || repo.lastUpdate.EstimatedValue == nil || *repo.lastUpdate.EstimatedValue != 140000 {
			t.Fatalf("expected the corrected value to reach repo.Update, got: %+v", repo.lastUpdate)
		}
		edit := repo.pendingEdits[pae.EditID]
		if len(edit.DecisionDiff) != 1 || edit.DecisionDiff[0].Field != "estimated_value" {
			t.Fatalf("expected a one-field correction diff on estimated_value, got: %+v", edit.DecisionDiff)
		}
	})

	t.Run("Reporting Manager rejects — nothing applied", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(strPtr(rmID))}
		alerts := &fakeAlertSvc{}
		svc := NewBidService(repo, alerts, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(150000)}
		var pae *domain.PendingApprovalError
		errors.As(svc.UpdateBid(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"}), &pae)

		if err := svc.RejectPendingEdit(context.Background(), pae.EditID, "not accurate", rmID, []string{"MANAGER"}); err != nil {
			t.Fatalf("RejectPendingEdit: %v", err)
		}
		if repo.lastUpdate != nil {
			t.Fatalf("expected nothing to reach repo.Update on rejection, got: %+v", repo.lastUpdate)
		}
		if !hasAlertType(alerts.created, "TENDER_EDIT_REJECTED") {
			t.Fatalf("expected a TENDER_EDIT_REJECTED alert to the executive, got: %+v", alerts.created)
		}
		edit := repo.pendingEdits[pae.EditID]
		if edit.Status != domain.EditApprovalRejected {
			t.Fatalf("expected edit status REJECTED, got %s", edit.Status)
		}
	})

	t.Run("an unrelated user cannot approve or reject", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid(strPtr(rmID))}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.UpdateBidRequest{FullEditSubmission: true, EstimatedValue: floatPtr(150000)}
		var pae *domain.PendingApprovalError
		errors.As(svc.UpdateBid(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"}), &pae)

		err := svc.ApprovePendingEdit(context.Background(), pae.EditID, &domain.UpdateBidRequest{EstimatedValue: floatPtr(150000)}, "", "some-other-user", []string{"BID_EXECUTIVE"})
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got: %v", err)
		}
	})
}

// TestCancelDeleteApproval covers extending the same Reporting-Manager gate
// used by Edit to Cancel (RecordOutcome, TransitionStage) and Delete
// (ArchiveBid, PermanentDeleteBid): a Bid Executive's action is held instead
// of applied, and approving it actually performs the cancel/delete.
func TestCancelDeleteApproval(t *testing.T) {
	rmID := "rm-user-1"
	execID := "exec-user-1"

	newBid := func() *domain.BidWorkspace {
		return &domain.BidWorkspace{
			ID: "bid-1", Title: "Test Tender",
			WorkflowStage: domain.StageDiscovered, CreationMode: domain.CreationModeManual,
			BidOwnerID: execID, ReportingManagerID: strPtr(rmID),
		}
	}

	t.Run("RecordOutcome CANCELLED is held for approval, not applied", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		req := &domain.RecordOutcomeRequest{BidOutcome: "CANCELLED", OutcomeReason: strPtr("client withdrew")}
		err := svc.RecordOutcome(context.Background(), "bid-1", req, execID, []string{"BID_EXECUTIVE"})

		var pae *domain.PendingApprovalError
		if !errors.As(err, &pae) {
			t.Fatalf("expected a PendingApprovalError, got: %v", err)
		}
		if repo.lastOutcome != nil {
			t.Fatalf("expected the cancellation NOT to reach repo.UpdateOutcome while pending, got: %+v", repo.lastOutcome)
		}

		if err := svc.ApprovePendingEdit(context.Background(), pae.EditID, &domain.UpdateBidRequest{}, "", rmID, []string{"MANAGER"}); err != nil {
			t.Fatalf("ApprovePendingEdit: %v", err)
		}
		if repo.lastOutcome == nil || repo.lastOutcome.BidOutcome != "CANCELLED" || repo.lastOutcome.OutcomeReason == nil || *repo.lastOutcome.OutcomeReason != "client withdrew" {
			t.Fatalf("expected the approved cancellation to reach repo.UpdateOutcome, got: %+v", repo.lastOutcome)
		}
	})

	t.Run("ArchiveBid is held for approval, not applied", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		err := svc.ArchiveBid(context.Background(), "bid-1", execID, []string{"BID_EXECUTIVE"})
		var pae *domain.PendingApprovalError
		if !errors.As(err, &pae) {
			t.Fatalf("expected a PendingApprovalError, got: %v", err)
		}
		if repo.softDeleted {
			t.Fatalf("expected SoftDelete NOT to run while pending")
		}

		if err := svc.ApprovePendingEdit(context.Background(), pae.EditID, &domain.UpdateBidRequest{}, "", rmID, []string{"MANAGER"}); err != nil {
			t.Fatalf("ApprovePendingEdit: %v", err)
		}
		if !repo.softDeleted {
			t.Fatalf("expected the approved archive to reach repo.SoftDelete")
		}
	})

	t.Run("PermanentDeleteBid is held for approval, and rejecting it leaves the tender untouched", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		err := svc.PermanentDeleteBid(context.Background(), "bid-1", execID, []string{"BID_EXECUTIVE"})
		var pae *domain.PendingApprovalError
		if !errors.As(err, &pae) {
			t.Fatalf("expected a PendingApprovalError, got: %v", err)
		}

		if err := svc.RejectPendingEdit(context.Background(), pae.EditID, "keep it for now", rmID, []string{"MANAGER"}); err != nil {
			t.Fatalf("RejectPendingEdit: %v", err)
		}
		if repo.permanentDeleted {
			t.Fatalf("expected PermanentDelete NOT to run on rejection")
		}
		edit := repo.pendingEdits[pae.EditID]
		if edit.Status != domain.EditApprovalRejected {
			t.Fatalf("expected edit status REJECTED, got %s", edit.Status)
		}
	})

	t.Run("exempt roles bypass the gate for Cancel and Delete", func(t *testing.T) {
		repo := &fakeBidRepo{bid: newBid()}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		if err := svc.ArchiveBid(context.Background(), "bid-1", "admin-1", []string{"SUPER_ADMIN"}); err != nil {
			t.Fatalf("ArchiveBid: %v", err)
		}
		if !repo.softDeleted {
			t.Fatalf("expected an exempt role's archive to apply immediately")
		}
	})
}

// TestGetPricingSuggestion covers the Pricing Request "suggested
// price/margin" hint: only APPROVED deals count, matching is case/
// whitespace-insensitive, the window truncates to the most recent N, and a
// never-priced product returns Count 0 (not an error).
func TestGetPricingSuggestion(t *testing.T) {
	marshalPW := func(t *testing.T, pw pricingWorkspaceJSON) []byte {
		t.Helper()
		b, err := json.Marshal(pw)
		if err != nil {
			t.Fatalf("marshal fixture: %v", err)
		}
		return b
	}
	floatp := func(f float64) *float64 { return &f }

	t.Run("never priced before — Count 0, not an error", func(t *testing.T) {
		repo := &fakeBidRepo{bid: &domain.BidWorkspace{ID: "bid-1"}, pricingCandidates: []domain.PricingWorkspaceRow{
			{BidID: "b1", BidTitle: "Other Tender", CreatedAt: time.Now(), PricingWorkspace: marshalPW(t, pricingWorkspaceJSON{
				ApprovalStatus: "APPROVED",
				Quotes:         []pricingQuoteJSON{{Items: []pricingItemJSON{{Desc: "Something Else", Qty: 1, BasicPrice: 100}}}},
			})},
		}}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		got, err := svc.GetPricingSuggestion(context.Background(), "AutoCAD LT for 3 Year Subscription")
		if err != nil {
			t.Fatalf("GetPricingSuggestion: %v", err)
		}
		if got.Count != 0 {
			t.Fatalf("expected Count 0, got %+v", got)
		}
	})

	t.Run("only APPROVED deals count, matching is case/whitespace-insensitive", func(t *testing.T) {
		now := time.Now()
		repo := &fakeBidRepo{bid: &domain.BidWorkspace{ID: "bid-1"}, pricingCandidates: []domain.PricingWorkspaceRow{
			// Approved — margin from the item override.
			{BidID: "b1", BidTitle: "Tender A", CreatedAt: now.Add(-24 * time.Hour), PricingWorkspace: marshalPW(t, pricingWorkspaceJSON{
				ApprovalStatus: "APPROVED", MarginPct: 2.45,
				Quotes: []pricingQuoteJSON{{Items: []pricingItemJSON{{Desc: "  autocad lt  ", Qty: 1, BasicPrice: 1000, MarginPct: floatp(4)}}}},
			})},
			// Approved — no item override, falls back to workspace marginPct.
			{BidID: "b2", BidTitle: "Tender B", CreatedAt: now, PricingWorkspace: marshalPW(t, pricingWorkspaceJSON{
				ApprovalStatus: "APPROVED", MarginPct: 6,
				Quotes: []pricingQuoteJSON{{Items: []pricingItemJSON{{Desc: "AutoCAD LT", Qty: 1, BasicPrice: 1000}}}},
			})},
			// Still pending approval — must not count.
			{BidID: "b3", BidTitle: "Tender C (pending)", CreatedAt: now.Add(1 * time.Hour), PricingWorkspace: marshalPW(t, pricingWorkspaceJSON{
				ApprovalStatus: "PENDING", MarginPct: 50,
				Quotes: []pricingQuoteJSON{{Items: []pricingItemJSON{{Desc: "AutoCAD LT", Qty: 1, BasicPrice: 1000}}}},
			})},
		}}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		got, err := svc.GetPricingSuggestion(context.Background(), "AutoCAD LT")
		if err != nil {
			t.Fatalf("GetPricingSuggestion: %v", err)
		}
		if got.Count != 2 {
			t.Fatalf("expected 2 approved deals (pending excluded), got %d: %+v", got.Count, got.Deals)
		}
		// (1000*1.04 + 1000*1.06) / 2 = 1050
		if math.Abs(got.AvgUnitPriceExclGst-1050) > 0.001 {
			t.Fatalf("expected avg unit price excl GST 1050, got %v", got.AvgUnitPriceExclGst)
		}
		if math.Abs(got.AvgMarginPct-5) > 0.001 {
			t.Fatalf("expected avg margin 5%%, got %v", got.AvgMarginPct)
		}
		// Tender B (now) is more recent than Tender A (now-24h) — its 6% margin is "last".
		if math.Abs(got.LastMarginPct-6) > 0.001 {
			t.Fatalf("expected last margin 6%% (most recent deal), got %v", got.LastMarginPct)
		}
	})

	t.Run("window truncates to the most recent N deals", func(t *testing.T) {
		now := time.Now()
		var candidates []domain.PricingWorkspaceRow
		for i := 0; i < 8; i++ {
			candidates = append(candidates, domain.PricingWorkspaceRow{
				BidID: fmt.Sprintf("b%d", i), BidTitle: fmt.Sprintf("Tender %d", i),
				CreatedAt: now.Add(-time.Duration(i) * time.Hour), // i=0 is most recent
				PricingWorkspace: marshalPW(t, pricingWorkspaceJSON{
					ApprovalStatus: "APPROVED", MarginPct: 3,
					Quotes: []pricingQuoteJSON{{Items: []pricingItemJSON{{Desc: "Widget", Qty: 1, BasicPrice: 100, MarginPct: floatp(float64(i))}}}},
				}),
			})
		}
		repo := &fakeBidRepo{bid: &domain.BidWorkspace{ID: "bid-1"}, pricingCandidates: candidates, pricingWindow: 3}
		svc := NewBidService(repo, &fakeAlertSvc{}, &fakeSystemLog{})

		got, err := svc.GetPricingSuggestion(context.Background(), "Widget")
		if err != nil {
			t.Fatalf("GetPricingSuggestion: %v", err)
		}
		if got.Count != 3 {
			t.Fatalf("expected window to cap at 3 deals, got %d", got.Count)
		}
		// Most recent 3 are i=0,1,2 (margins 0,1,2) — last (most recent) is i=0's margin 0.
		if math.Abs(got.LastMarginPct-0) > 0.001 {
			t.Fatalf("expected last margin 0 (most recent), got %v", got.LastMarginPct)
		}
		if math.Abs(got.AvgMarginPct-1) > 0.001 { // (0+1+2)/3
			t.Fatalf("expected avg margin 1, got %v", got.AvgMarginPct)
		}
	})
}
