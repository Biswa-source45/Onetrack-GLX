package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/bid/domain"
)

const (
	finance = "user-fm"
	mdOne   = "user-md1"
	mdTwo   = "user-md2"
)

var (
	financeRoles = []string{"FINANCE"}
	adminRoles   = []string{"ADMIN"}
	superRoles   = []string{"SUPER_ADMIN"}
)

type emdTestSetup struct {
	svc    domain.BidService
	repo   *fakeBidRepo
	alerts *fakeAlertSvc
}

func newEMDTestSetup() *emdTestSetup {
	repo := &fakeBidRepo{
		bid: &domain.BidWorkspace{
			ID:               "bid-123",
			Title:            "Procurement of IT Hardware",
			EMDAmount:        float64Ptr(50000),
			WorkflowStage:    domain.StageEMDProcessing,
			CreationMode:     domain.CreationModeManual,
			CreatedBy:        "user-admin",
			BidOwnerID:       "owner-1",
			EMDType:          strPtr("ONLINE"),
			StageCompletions: []byte(`{}`),
		},
	}
	alerts := &fakeAlertSvc{}
	return &emdTestSetup{svc: NewBidService(repo, alerts, &fakeSystemLog{}), repo: repo, alerts: alerts}
}

func float64Ptr(v float64) *float64 { return &v }

func wantErr(t *testing.T, err, target error, what string) {
	t.Helper()
	if !errors.Is(err, target) {
		t.Fatalf("%s: err = %v, want %v", what, err, target)
	}
}

// fill gives the lifecycle the due date, reference and purpose submission needs.
func (s *emdTestSetup) fill(t *testing.T) {
	t.Helper()
	_, err := s.svc.UpdateBasicEMD(context.Background(), "bid-123", &domain.UpdateBasicEMDRequest{
		DueDate:         strPtr(time.Now().Format("2006-01-02")),
		ReferenceNumber: strPtr("REF-001"),
		Purpose:         strPtr("GeM Bid Deposit"),
	}, finance, financeRoles)
	if err != nil {
		t.Fatalf("fill: %v", err)
	}
}

func (s *emdTestSetup) submit(t *testing.T) {
	t.Helper()
	if _, err := s.svc.SubmitEMDForMDApproval(context.Background(), "bid-123", &domain.SubmitMDApprovalRequest{}, finance, financeRoles); err != nil {
		t.Fatalf("submit: %v", err)
	}
}

func (s *emdTestSetup) approve(t *testing.T) {
	t.Helper()
	if _, err := s.svc.ApproveEMD(context.Background(), "bid-123", &domain.MDDecisionRequest{Remarks: "ok"}, mdOne, adminRoles); err != nil {
		t.Fatalf("approve: %v", err)
	}
}

func onlinePayment(amount float64) *domain.RecordEMDPaymentRequest {
	today := time.Now().Format("2006-01-02")
	return &domain.RecordEMDPaymentRequest{
		PaymentMode:   domain.PaymentModeOnline,
		PaymentAmount: amount,
		PaymentDate:   today,
		PaymentStatus: "Successful",
		OnlineDetails: &domain.OnlinePaymentDetails{
			TransactionID:       "UTR99238411",
			PaymentGateway:      "Razorpay",
			TransactionDateTime: time.Now().Format(time.RFC3339),
		},
		Depositor: domain.DepositorDetailsDTO{Name: "Rahul Kumar", Department: "Finance", DepositDate: today},
	}
}

// pay walks a fresh tender to Paid.
func (s *emdTestSetup) pay(t *testing.T) *domain.TenderEMDResponse {
	t.Helper()
	s.fill(t)
	s.submit(t)
	s.approve(t)
	resp, err := s.svc.RecordEMDPayment(context.Background(), "bid-123", onlinePayment(50000), finance, financeRoles)
	if err != nil {
		t.Fatalf("pay: %v", err)
	}
	return resp
}

func TestEMD_ExemptedTenderRejectsEveryMutationAndGetIsReadOnly(t *testing.T) {
	for _, tc := range []struct {
		name       string
		set        func(b *domain.BidWorkspace)
		wantStatus string
	}{
		{"exempted", func(b *domain.BidWorkspace) { b.EMDExempted = true; b.EMDExemptionType = strPtr("STARTUP") }, domain.EMDStatusExempted},
		{"not applicable", func(b *domain.BidWorkspace) { b.EMDNotApplicable = true }, domain.EMDStatusNotApplicable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := newEMDTestSetup()
			tc.set(s.repo.bid)
			ctx := context.Background()

			calls := map[string]func() error{
				"basic": func() error {
					_, e := s.svc.UpdateBasicEMD(ctx, "bid-123", &domain.UpdateBasicEMDRequest{Purpose: strPtr("x")}, finance, financeRoles)
					return e
				},
				"submit": func() error {
					_, e := s.svc.SubmitEMDForMDApproval(ctx, "bid-123", nil, finance, financeRoles)
					return e
				},
				"approve": func() error {
					_, e := s.svc.ApproveEMD(ctx, "bid-123", &domain.MDDecisionRequest{}, mdOne, adminRoles)
					return e
				},
				"reject": func() error {
					_, e := s.svc.RejectEMD(ctx, "bid-123", &domain.MDDecisionRequest{Remarks: "no"}, mdOne, adminRoles)
					return e
				},
				"pay": func() error {
					_, e := s.svc.RecordEMDPayment(ctx, "bid-123", onlinePayment(50000), finance, financeRoles)
					return e
				},
				"verify": func() error {
					_, e := s.svc.VerifyEMDPayment(ctx, "bid-123", &domain.VerifyEMDPaymentRequest{Status: "Verified"}, finance, financeRoles)
					return e
				},
				"refund": func() error {
					_, e := s.svc.UpdateEMDRefund(ctx, "bid-123", &domain.UpdateEMDRefundRequest{RefundStatus: domain.RefundStatusPending}, finance, financeRoles)
					return e
				},
				"upload": func() error { return s.svc.EnsureEMDRequired(ctx, "bid-123") },
			}
			for name, call := range calls {
				wantErr(t, call(), domain.ErrValidation, name)
			}

			resp, err := s.svc.GetEMDDetails(ctx, "bid-123", financeRoles)
			if err != nil {
				t.Fatal(err)
			}
			if resp.Status != tc.wantStatus || resp.EMDAmount != 50000 {
				t.Fatalf("view = %q / %v, want %q / 50000", resp.Status, resp.EMDAmount, tc.wantStatus)
			}
			if s.repo.emd != nil || len(s.alerts.created) != 0 {
				t.Fatal("an exempted tender must get no EMD row and no alert")
			}
			logs, err := s.svc.GetEMDAuditLogs(ctx, "bid-123")
			if err != nil || len(logs) != 0 {
				t.Fatalf("audit logs = %v, %v", logs, err)
			}
		})
	}
}

func TestEMD_GetNeverWritesAndHidesDetailsFromOthers(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	resp, err := s.svc.GetEMDDetails(ctx, "bid-123", financeRoles)
	if err != nil {
		t.Fatal(err)
	}
	if resp.Status != domain.EMDStatusPending || resp.EMDAmount != 50000 {
		t.Fatalf("default view = %q / %v", resp.Status, resp.EMDAmount)
	}
	if s.repo.emd != nil {
		t.Fatal("GET must not insert a row")
	}

	s.pay(t)
	full, _ := s.svc.GetEMDDetails(ctx, "bid-123", financeRoles)
	if full.DepositorName == nil || full.PaymentReference == nil {
		t.Fatal("Finance should see depositor and payment details")
	}
	limited, err := s.svc.GetEMDDetails(ctx, "bid-123", []string{"BID_EXECUTIVE"})
	if err != nil {
		t.Fatal(err)
	}
	if limited.DepositorName != nil || limited.PaymentReference != nil || limited.PaymentDetails != nil {
		t.Fatal("other roles must not see depositor or bank details")
	}
	if limited.Status != domain.EMDStatusPaid || limited.EMDAmount != 50000 {
		t.Fatalf("limited view = %q / %v", limited.Status, limited.EMDAmount)
	}
}

func TestEMD_RejectResubmitApprovePay(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()
	s.fill(t)

	// Nothing can be paid before approval.
	_, err := s.svc.RecordEMDPayment(ctx, "bid-123", onlinePayment(50000), finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "pay before approval")

	s.submit(t)
	_, err = s.svc.RejectEMD(ctx, "bid-123", &domain.MDDecisionRequest{}, mdOne, adminRoles)
	wantErr(t, err, domain.ErrValidation, "reject without a reason")
	rej, err := s.svc.RejectEMD(ctx, "bid-123", &domain.MDDecisionRequest{Remarks: "wrong due date"}, mdOne, adminRoles)
	if err != nil {
		t.Fatal(err)
	}
	if rej.Status != domain.EMDStatusRejected || rej.IsMDApproved {
		t.Fatalf("rejected: status=%q approved=%v", rej.Status, rej.IsMDApproved)
	}
	_, err = s.svc.RecordEMDPayment(ctx, "bid-123", onlinePayment(50000), finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "pay after rejection")

	// Re-submitting clears the old decision.
	re, err := s.svc.SubmitEMDForMDApproval(ctx, "bid-123", &domain.SubmitMDApprovalRequest{}, finance, financeRoles)
	if err != nil {
		t.Fatal(err)
	}
	if re.Status != domain.EMDStatusPendingMDApproval || re.MDDecidedAt != nil || re.MDDecisionRemarks != nil || re.IsMDApproved {
		t.Fatalf("resubmitted: %+v", re)
	}

	s.approve(t)
	if s.repo.bid.EMDReady {
		t.Fatal("approval alone must not make the EMD ready")
	}
	paid, err := s.svc.RecordEMDPayment(ctx, "bid-123", onlinePayment(50000), finance, financeRoles)
	if err != nil {
		t.Fatal(err)
	}
	if paid.Status != domain.EMDStatusPaid || !paid.IsPaid || !paid.IsMDApproved {
		t.Fatalf("paid: %+v", paid)
	}
	if !s.repo.bid.EMDReady {
		t.Fatal("payment must set emd_ready")
	}

	// Same record the Mark-EMD-Ready button leaves: a FINANCE stage event plus a requester alert.
	var found bool
	for _, h := range s.repo.addedHistory {
		if h.EventType != nil && *h.EventType == "FINANCE" {
			var d map[string]string
			_ = json.Unmarshal(h.Details, &d)
			found = d["approvedBy"] == "FINANCE"
		}
	}
	if !found {
		t.Fatal("missing FINANCE stage-history event with approvedBy=FINANCE")
	}
	var notified bool
	for _, a := range s.alerts.created {
		notified = notified || (a.Type == "EMD" && a.UserID != nil && *a.UserID == "owner-1")
	}
	if !notified {
		t.Fatal("requester was not notified")
	}
}

func TestEMD_MakerCannotBeChecker(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()
	s.fill(t)
	if _, err := s.svc.SubmitEMDForMDApproval(ctx, "bid-123", nil, mdOne, adminRoles); err != nil {
		t.Fatal(err)
	}
	_, err := s.svc.ApproveEMD(ctx, "bid-123", &domain.MDDecisionRequest{}, mdOne, adminRoles)
	wantErr(t, err, domain.ErrForbidden, "self approval")
	_, err = s.svc.RejectEMD(ctx, "bid-123", &domain.MDDecisionRequest{Remarks: "x"}, mdOne, adminRoles)
	wantErr(t, err, domain.ErrForbidden, "self rejection")
	if _, err := s.svc.ApproveEMD(ctx, "bid-123", &domain.MDDecisionRequest{}, mdTwo, superRoles); err != nil {
		t.Fatalf("a different admin must be able to approve: %v", err)
	}
	_, err = s.svc.ApproveEMD(ctx, "bid-123", &domain.MDDecisionRequest{}, mdTwo, superRoles)
	wantErr(t, err, domain.ErrValidation, "approving twice")
}

func TestEMD_SubmitAlertsSuperAdminAndAdmin(t *testing.T) {
	s := newEMDTestSetup()
	s.fill(t)
	s.submit(t)
	roles := map[string]bool{}
	for _, a := range s.alerts.created {
		roles[a.TargetRole] = true
		if a.Link != alertDomain.StageLink("bid-123", domain.StageEMDProcessing) {
			t.Fatalf("expected alert Link to be %q, got %q", alertDomain.StageLink("bid-123", domain.StageEMDProcessing), a.Link)
		}
	}
	if !roles["SUPER_ADMIN"] || !roles["ADMIN"] {
		t.Fatalf("alert targets = %v", roles)
	}
}

func TestEMD_BasicUpdateCannotTouchStatusAndLocksWhilePending(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()
	s.fill(t)
	if s.repo.emd.Status != domain.EMDStatusPending {
		t.Fatalf("status = %q", s.repo.emd.Status)
	}
	s.submit(t)
	_, err := s.svc.UpdateBasicEMD(ctx, "bid-123", &domain.UpdateBasicEMDRequest{Purpose: strPtr("changed")}, finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "edit while pending approval")
	_, err = s.svc.UpdateBasicEMD(ctx, "bid-123", &domain.UpdateBasicEMDRequest{}, "user-exec", []string{"BID_EXECUTIVE"})
	wantErr(t, err, domain.ErrForbidden, "non-finance edit")
}

func TestEMD_PaymentValidation(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()
	s.fill(t)
	s.submit(t)
	s.approve(t)

	for amount, word := range map[float64]string{40000: "less", 60000: "greater", 49999.99: "less"} {
		_, err := s.svc.RecordEMDPayment(ctx, "bid-123", onlinePayment(amount), finance, financeRoles)
		wantErr(t, err, domain.ErrValidation, "amount "+word)
	}

	missingUTR := onlinePayment(50000)
	missingUTR.OnlineDetails.TransactionID = ""
	_, err := s.svc.RecordEMDPayment(ctx, "bid-123", missingUTR, finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "missing UTR")

	badMode := onlinePayment(50000)
	badMode.PaymentMode = "Cash"
	_, err = s.svc.RecordEMDPayment(ctx, "bid-123", badMode, finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "invalid payment mode")

	for _, u := range []string{"javascript:alert(1)", "/api/v1/bids/other-bid/emd/receipt/" + "0123456789abcdef0123456789abcdef.pdf", "/api/v1/bids/bid-123/emd/receipt/../x.pdf"} {
		bad := onlinePayment(50000)
		bad.PaymentReceiptURL = strPtr(u)
		_, err = s.svc.RecordEMDPayment(ctx, "bid-123", bad, finance, financeRoles)
		wantErr(t, err, domain.ErrValidation, "receipt url "+u)
	}
	if s.repo.emd.Status != domain.EMDStatusMDApproved || s.repo.bid.EMDReady {
		t.Fatal("failed payments must leave the EMD untouched")
	}

	good := onlinePayment(50000)
	good.PaymentReceiptURL = strPtr("/api/v1/bids/bid-123/emd/receipt/0123456789abcdef0123456789abcdef.pdf")
	if _, err := s.svc.RecordEMDPayment(ctx, "bid-123", good, finance, financeRoles); err != nil {
		t.Fatalf("valid payment: %v", err)
	}
	// A recorded payment is only correctable by an administrator.
	_, err = s.svc.RecordEMDPayment(ctx, "bid-123", onlinePayment(50000), finance, financeRoles)
	wantErr(t, err, domain.ErrForbidden, "finance re-recording")
	if _, err := s.svc.RecordEMDPayment(ctx, "bid-123", onlinePayment(50000), mdOne, adminRoles); err != nil {
		t.Fatalf("admin correction: %v", err)
	}
	if got := s.repo.emdLogs[len(s.repo.emdLogs)-1]; got.ActorRole == nil || *got.ActorRole != "ADMIN" {
		t.Fatalf("audit actor role = %v", got.ActorRole)
	}
}

func TestEMD_VerifyAndRefund(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	_, err := s.svc.VerifyEMDPayment(ctx, "bid-123", &domain.VerifyEMDPaymentRequest{Status: "Verified"}, finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "verify before payment")
	_, err = s.svc.UpdateEMDRefund(ctx, "bid-123", &domain.UpdateEMDRefundRequest{RefundStatus: domain.RefundStatusInitiated}, finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "refund before payment")

	s.pay(t)

	_, err = s.svc.VerifyEMDPayment(ctx, "bid-123", &domain.VerifyEMDPaymentRequest{Status: "Bogus"}, finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "invalid verification status")
	rej, err := s.svc.VerifyEMDPayment(ctx, "bid-123", &domain.VerifyEMDPaymentRequest{Status: "Rejected"}, finance, financeRoles)
	if err != nil || rej.Status != domain.EMDStatusVerificationRejected {
		t.Fatalf("verification rejected: %v %+v", err, rej)
	}
	if s.repo.bid.EMDReady {
		t.Fatal("a rejected verification must clear emd_ready")
	}
	// Re-recording the payment restarts verification.
	if _, err := s.svc.RecordEMDPayment(ctx, "bid-123", onlinePayment(50000), finance, financeRoles); err != nil {
		t.Fatal(err)
	}
	ver, err := s.svc.VerifyEMDPayment(ctx, "bid-123", &domain.VerifyEMDPaymentRequest{Status: "Verified"}, finance, financeRoles)
	if err != nil || ver.Status != domain.EMDStatusVerified {
		t.Fatalf("verified: %v %+v", err, ver)
	}

	today := time.Now().Format("2006-01-02")
	for name, req := range map[string]*domain.UpdateEMDRefundRequest{
		"unknown status":   {RefundStatus: "Bogus"},
		"more than paid":   {RefundStatus: domain.RefundStatusInitiated, RefundAmount: float64Ptr(50000.01)},
		"zero amount":      {RefundStatus: domain.RefundStatusInitiated, RefundAmount: float64Ptr(0)},
		"refunded no date": {RefundStatus: domain.RefundStatusRefunded},
		"bad receipt url":  {RefundStatus: domain.RefundStatusInitiated, RefundReceiptURL: strPtr("javascript:1")},
	} {
		_, err := s.svc.UpdateEMDRefund(ctx, "bid-123", req, finance, financeRoles)
		wantErr(t, err, domain.ErrValidation, name)
	}

	part, err := s.svc.UpdateEMDRefund(ctx, "bid-123", &domain.UpdateEMDRefundRequest{RefundStatus: domain.RefundStatusInitiated, RefundAmount: float64Ptr(20000)}, finance, financeRoles)
	if err != nil || part.Status != domain.EMDStatusVerified || s.repo.bid.EMDReturned {
		t.Fatalf("partial refund: %v %+v", err, part)
	}
	done, err := s.svc.UpdateEMDRefund(ctx, "bid-123", &domain.UpdateEMDRefundRequest{
		RefundStatus: domain.RefundStatusRefunded, ActualRefundDate: &today, RefundAmount: float64Ptr(50000),
		RefundMode: strPtr("Online"), RefundTransactionID: strPtr("REF-UTR-883"),
	}, finance, financeRoles)
	if err != nil || done.Status != domain.EMDStatusRefunded || !s.repo.bid.EMDReturned {
		t.Fatalf("refund: %v %+v", err, done)
	}
	_, err = s.svc.UpdateEMDRefund(ctx, "bid-123", &domain.UpdateEMDRefundRequest{RefundStatus: domain.RefundStatusPending}, finance, financeRoles)
	wantErr(t, err, domain.ErrValidation, "refund after refunded")
}

// A tender confirmed ready through the old button has a synthetic Paid row with no
// payment details; Finance (not only an admin) can complete it.
func TestEMD_LegacyReadyTenderLetsFinanceRecordPayment(t *testing.T) {
	s := newEMDTestSetup()
	s.repo.bid.EMDReady = true
	s.repo.emd = &domain.TenderEMDDetails{ID: "emd-1", BidID: "bid-123", EMDAmount: 50000, Status: domain.EMDStatusPaid,
		VerificationStatus: domain.VerificationStatusPending, RefundStatus: domain.RefundStatusPending}
	if _, err := s.svc.RecordEMDPayment(context.Background(), "bid-123", onlinePayment(50000), finance, financeRoles); err != nil {
		t.Fatalf("finance could not complete a legacy-ready row: %v", err)
	}
	// Once details exist, correcting them is admin-only again.
	_, err := s.svc.RecordEMDPayment(context.Background(), "bid-123", onlinePayment(50000), finance, financeRoles)
	wantErr(t, err, domain.ErrForbidden, "finance re-recording a recorded payment")
}

func TestEMD_ReadyGate(t *testing.T) {
	ready := &domain.UpdateBidRequest{EMDReady: boolPtr(true)}
	for _, tc := range []struct {
		name   string
		status string // "" = no lifecycle row
		roles  []string
		want   error
	}{
		{"no lifecycle row", "", financeRoles, nil},
		{"pending but not submitted", domain.EMDStatusPending, financeRoles, nil},
		{"awaiting approval, finance", domain.EMDStatusPendingMDApproval, financeRoles, domain.ErrForbidden},
		{"rejected, finance", domain.EMDStatusRejected, financeRoles, domain.ErrForbidden},
		{"awaiting approval, admin override", domain.EMDStatusPendingMDApproval, adminRoles, nil},
		{"rejected, super admin override", domain.EMDStatusRejected, superRoles, nil},
		{"approved, finance", domain.EMDStatusMDApproved, financeRoles, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := newEMDTestSetup()
			if tc.status != "" {
				s.repo.emd = &domain.TenderEMDDetails{BidID: "bid-123", Status: tc.status}
			}
			err := s.svc.UpdateBid(context.Background(), "bid-123", ready, "actor-1", tc.roles)
			if tc.want == nil && err != nil {
				t.Fatalf("err = %v", err)
			}
			if tc.want != nil {
				wantErr(t, err, tc.want, tc.name)
			}
		})
	}
}

func TestEMD_SwitchingToExemptClosesOpenRow(t *testing.T) {
	s := newEMDTestSetup()
	s.repo.emd = &domain.TenderEMDDetails{BidID: "bid-123", Status: domain.EMDStatusPendingMDApproval}
	req := &domain.UpdateBidRequest{EMDNotApplicable: boolPtr(true)}
	if err := s.svc.UpdateBid(context.Background(), "bid-123", req, "actor-1", adminRoles); err != nil {
		t.Fatal(err)
	}
	if !s.repo.emdClosed {
		t.Fatal("open lifecycle row was not closed")
	}
}

func TestChecklist_ToggleKeepsStatusInSync(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()
	s.repo.checklists = []domain.BidChecklist{{ID: "c1", BidID: "bid-123", Title: "t"}}

	if _, err := s.svc.ToggleChecklist(ctx, "bid-123", "c1", true, "u"); err != nil || s.repo.lastToggled != "COMPLETED" {
		t.Fatalf("done: %v status=%q", err, s.repo.lastToggled)
	}
	if _, err := s.svc.ToggleChecklist(ctx, "bid-123", "c1", false, "u"); err != nil || s.repo.lastToggled != "PENDING" {
		t.Fatalf("undone: %v status=%q", err, s.repo.lastToggled)
	}
}

func TestChecklist_ValidatesPriorityAndStatus(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()
	_, err := s.svc.AddChecklist(ctx, "bid-123", &domain.AddChecklistRequest{Title: "t", Priority: strPtr("URGENT")})
	wantErr(t, err, domain.ErrValidation, "add with bad priority")
	_, err = s.svc.UpdateChecklist(ctx, "bid-123", "c1", &domain.UpdateChecklistRequest{Status: strPtr("DONE")})
	wantErr(t, err, domain.ErrValidation, "update with bad status")
	_, err = s.svc.UpdateChecklist(ctx, "bid-123", "c1", &domain.UpdateChecklistRequest{Priority: strPtr("low")})
	wantErr(t, err, domain.ErrValidation, "priority is case sensitive")
}
