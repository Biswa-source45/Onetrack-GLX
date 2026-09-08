package service

import (
	"context"
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
	return nil
}
func (f *fakeBidRepo) GetStageHistory(ctx context.Context, bidID string) ([]domain.BidStageHistory, error) {
	return nil, nil
}
func (f *fakeBidRepo) GetGlobalAuditLogs(ctx context.Context, limit int) ([]domain.GlobalAuditItem, error) {
	return nil, nil
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

// fakeAlertSvc records every alert CreateAlert was called with, so the test
// can assert on what was (or wasn't) sent.
type fakeAlertSvc struct {
	created []*alertDomain.Alert
}

func (f *fakeAlertSvc) CreateAlert(ctx context.Context, alert *alertDomain.Alert) error {
	f.created = append(f.created, alert)
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
