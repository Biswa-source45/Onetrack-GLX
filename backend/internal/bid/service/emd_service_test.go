package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/onetrack/backend/internal/bid/domain"
)

type emdTestSetup struct {
	svc  domain.BidService
	repo *fakeBidRepo
}

func newEMDTestSetup() *emdTestSetup {
	repo := &fakeBidRepo{
		bid: &domain.BidWorkspace{
			ID:            "bid-123",
			Title:         "Procurement of IT Hardware",
			EMDAmount:     float64Ptr(50000),
			WorkflowStage: domain.StageEMDProcessing,
			CreatedBy:     "user-admin",
		},
	}
	alertSvc := &fakeAlertSvc{}
	sysLog := &fakeSystemLog{}
	svc := NewBidService(repo, alertSvc, sysLog)
	return &emdTestSetup{svc: svc, repo: repo}
}

func float64Ptr(v float64) *float64 {
	return &v
}

func TestUpdateBasicEMD_Validation(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	// Zero or negative amount should fail
	_, err := s.svc.UpdateBasicEMD(ctx, "bid-123", &domain.UpdateBasicEMDRequest{
		EMDAmount: float64Ptr(0),
	}, "user-fm", []string{"FINANCE"})
	if err == nil || !strings.Contains(err.Error(), "greater than zero") {
		t.Fatalf("expected error for zero EMD amount, got %v", err)
	}

	// Valid amount should succeed
	resp, err := s.svc.UpdateBasicEMD(ctx, "bid-123", &domain.UpdateBasicEMDRequest{
		EMDAmount: float64Ptr(75000),
		Purpose:   strPtr("Tender security deposit"),
	}, "user-fm", []string{"FINANCE"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.EMDAmount != 75000 {
		t.Errorf("expected EMDAmount 75000, got %f", resp.EMDAmount)
	}
}

func TestSubmitEMDForMDApproval(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	// Set initial valid basic details
	now := time.Now().Format("2006-01-02")
	_, err := s.svc.UpdateBasicEMD(ctx, "bid-123", &domain.UpdateBasicEMDRequest{
		EMDAmount:       float64Ptr(50000),
		DueDate:         &now,
		ReferenceNumber: strPtr("REF-001"),
		Purpose:         strPtr("GeM Bid Deposit"),
	}, "user-fm", []string{"FINANCE"})
	if err != nil {
		t.Fatalf("failed to update basic emd: %v", err)
	}

	// Submit for MD approval
	resp, err := s.svc.SubmitEMDForMDApproval(ctx, "bid-123", &domain.SubmitMDApprovalRequest{
		Remarks: strPtr("Verified and ready for MD review"),
	}, "user-fm", []string{"FINANCE"})
	if err != nil {
		t.Fatalf("failed to submit for MD approval: %v", err)
	}
	if resp.Status != domain.EMDStatusPendingMDApproval {
		t.Errorf("expected status %s, got %s", domain.EMDStatusPendingMDApproval, resp.Status)
	}
}

func TestMDApprovalAndRejection(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	// Finance user cannot approve
	_, err := s.svc.ApproveEMD(ctx, "bid-123", &domain.MDDecisionRequest{
		Remarks: "Approved",
	}, "user-fm", []string{"FINANCE"})
	if err == nil {
		t.Fatal("expected error when Finance user tries to approve EMD")
	}

	// Super Admin / Admin approves
	resp, err := s.svc.ApproveEMD(ctx, "bid-123", &domain.MDDecisionRequest{
		Remarks: "Approved by MD",
	}, "user-md", []string{"SUPER_ADMIN"})
	if err != nil {
		t.Fatalf("unexpected error approving EMD: %v", err)
	}
	if resp.Status != domain.EMDStatusMDApproved {
		t.Errorf("expected status %s, got %s", domain.EMDStatusMDApproved, resp.Status)
	}
	if !resp.IsMDApproved {
		t.Errorf("expected IsMDApproved to be true")
	}

	// Rejection requires remarks
	_, err = s.svc.RejectEMD(ctx, "bid-123", &domain.MDDecisionRequest{
		Remarks: "",
	}, "user-md", []string{"SUPER_ADMIN"})
	if err == nil {
		t.Fatal("expected error when rejecting without remarks")
	}

	// Rejection with remarks succeeds
	rejectResp, err := s.svc.RejectEMD(ctx, "bid-123", &domain.MDDecisionRequest{
		Remarks: "Discrepancy in due date vs tender schedule",
	}, "user-md", []string{"SUPER_ADMIN"})
	if err != nil {
		t.Fatalf("unexpected error rejecting EMD: %v", err)
	}
	if rejectResp.Status != domain.EMDStatusRejected {
		t.Errorf("expected status %s, got %s", domain.EMDStatusRejected, rejectResp.Status)
	}
}

func TestRecordEMDPayment_OnlineAndCheque(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	// Approve EMD first
	_, _ = s.svc.ApproveEMD(ctx, "bid-123", &domain.MDDecisionRequest{Remarks: "OK"}, "user-md", []string{"SUPER_ADMIN"})

	// Record payment: Online missing UTR should fail
	_, err := s.svc.RecordEMDPayment(ctx, "bid-123", &domain.RecordEMDPaymentRequest{
		PaymentMode:   domain.PaymentModeOnline,
		PaymentAmount: 50000,
		PaymentDate:   time.Now().Format("2006-01-02"),
		PaymentStatus: "Successful",
		OnlineDetails: &domain.OnlinePaymentDetails{
			TransactionID:  "",
			PaymentGateway: "Razorpay",
		},
		Depositor: domain.DepositorDetailsDTO{
			Name:        "Rahul Kumar",
			Department:  "Finance",
			DepositDate: time.Now().Format("2006-01-02"),
		},
	}, "user-fm", []string{"FINANCE"})
	if err == nil {
		t.Fatal("expected error when transaction ID is missing for online payment")
	}

	// Valid Online payment succeeds
	resp, err := s.svc.RecordEMDPayment(ctx, "bid-123", &domain.RecordEMDPaymentRequest{
		PaymentMode:   domain.PaymentModeOnline,
		PaymentAmount: 50000,
		PaymentDate:   time.Now().Format("2006-01-02"),
		PaymentStatus: "Successful",
		OnlineDetails: &domain.OnlinePaymentDetails{
			TransactionID:       "UTR99238411",
			PaymentGateway:      "Razorpay",
			TransactionDateTime: time.Now().Format(time.RFC3339),
			PaymentStatus:       "Successful",
		},
		Depositor: domain.DepositorDetailsDTO{
			Name:        "Rahul Kumar",
			Department:  "Finance",
			DepositDate: time.Now().Format("2006-01-02"),
		},
	}, "user-fm", []string{"FINANCE"})
	if err != nil {
		t.Fatalf("unexpected error recording online payment: %v", err)
	}
	if resp.Status != domain.EMDStatusPaid {
		t.Errorf("expected status %s, got %s", domain.EMDStatusPaid, resp.Status)
	}
	if !resp.IsPaid {
		t.Errorf("expected IsPaid to be true")
	}
}

func TestUpdateEMDRefund(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	// Refund amount exceeding EMD should fail
	_, err := s.svc.UpdateEMDRefund(ctx, "bid-123", &domain.UpdateEMDRefundRequest{
		RefundStatus: domain.RefundStatusInitiated,
		RefundAmount: float64Ptr(999999),
	}, "user-fm", []string{"FINANCE"})
	if err == nil {
		t.Fatal("expected error when refund amount exceeds EMD amount")
	}

	// Refunded status requires ActualRefundDate
	_, err = s.svc.UpdateEMDRefund(ctx, "bid-123", &domain.UpdateEMDRefundRequest{
		RefundStatus:     domain.RefundStatusRefunded,
		ActualRefundDate: nil,
	}, "user-fm", []string{"FINANCE"})
	if err == nil {
		t.Fatal("expected error when actual refund date is missing for Refunded status")
	}

	// Valid refund update succeeds
	today := time.Now().Format("2006-01-02")
	resp, err := s.svc.UpdateEMDRefund(ctx, "bid-123", &domain.UpdateEMDRefundRequest{
		RefundStatus:          domain.RefundStatusRefunded,
		ActualRefundDate:      &today,
		RefundAmount:          float64Ptr(50000),
		RefundMode:            strPtr("Online"),
		RefundTransactionID:   strPtr("REF-UTR-883"),
		RefundReferenceNumber: strPtr("REF-UTR-883"),
	}, "user-fm", []string{"FINANCE"})
	if err != nil {
		t.Fatalf("unexpected error updating refund: %v", err)
	}
	if resp.Status != domain.EMDStatusRefunded {
		t.Errorf("expected status %s, got %s", domain.EMDStatusRefunded, resp.Status)
	}
	if !resp.IsRefunded {
		t.Errorf("expected IsRefunded to be true")
	}
}

func TestRecordEMDPayment_AmountValidation(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	// Initial EMD amount is 50000 on bid-123
	today := time.Now().Format("2006-01-02")
	baseReq := domain.RecordEMDPaymentRequest{
		PaymentMode:   domain.PaymentModeOnline,
		PaymentDate:   today,
		PaymentStatus: "Successful",
		OnlineDetails: &domain.OnlinePaymentDetails{
			TransactionID:       "UTR-TEST-123",
			PaymentGateway:      "Razorpay",
			TransactionDateTime: time.Now().Format(time.RFC3339),
			PaymentStatus:       "Successful",
		},
		Depositor: domain.DepositorDetailsDTO{
			Name:        "Rahul Kumar",
			Department:  "Finance",
			DepositDate: today,
		},
	}

	// 1. Payment amount LESS than EMD amount (e.g. 40000 < 50000) should fail
	lessReq := baseReq
	lessReq.PaymentAmount = 40000
	_, err := s.svc.RecordEMDPayment(ctx, "bid-123", &lessReq, "user-fm", []string{"FINANCE"})
	if err == nil || !strings.Contains(err.Error(), "cannot be less than") {
		t.Fatalf("expected error when payment amount is less than EMD amount, got %v", err)
	}

	// 2. Payment amount GREATER than EMD amount (e.g. 60000 > 50000) should fail
	greaterReq := baseReq
	greaterReq.PaymentAmount = 60000
	_, err = s.svc.RecordEMDPayment(ctx, "bid-123", &greaterReq, "user-fm", []string{"FINANCE"})
	if err == nil || !strings.Contains(err.Error(), "cannot be greater than") {
		t.Fatalf("expected error when payment amount is greater than EMD amount, got %v", err)
	}

	// 3. Exact matching payment amount (50000 == 50000) should succeed
	exactReq := baseReq
	exactReq.PaymentAmount = 50000
	resp, err := s.svc.RecordEMDPayment(ctx, "bid-123", &exactReq, "user-fm", []string{"FINANCE"})
	if err != nil {
		t.Fatalf("unexpected error when payment amount exactly matches: %v", err)
	}
	if resp.Status != domain.EMDStatusPaid {
		t.Errorf("expected status %s, got %s", domain.EMDStatusPaid, resp.Status)
	}
}

func TestEMD_RoleRestrictions(t *testing.T) {
	s := newEMDTestSetup()
	ctx := context.Background()

	// Non-authorized roles (BID_EXECUTIVE, BID_MANAGER, SALES) should fail
	_, err := s.svc.UpdateBasicEMD(ctx, "bid-123", &domain.UpdateBasicEMDRequest{
		EMDAmount: float64Ptr(50000),
	}, "user-exec", []string{"BID_EXECUTIVE"})
	if err == nil {
		t.Fatal("expected error when BID_EXECUTIVE tries to update basic EMD")
	}

	today := time.Now().Format("2006-01-02")
	payReq := &domain.RecordEMDPaymentRequest{
		PaymentMode:   domain.PaymentModeOnline,
		PaymentAmount: 50000,
		PaymentDate:   today,
		PaymentStatus: "Successful",
		OnlineDetails: &domain.OnlinePaymentDetails{
			TransactionID:       "UTR-TEST-123",
			PaymentGateway:      "Razorpay",
			TransactionDateTime: time.Now().Format(time.RFC3339),
			PaymentStatus:       "Successful",
		},
		Depositor: domain.DepositorDetailsDTO{
			Name:        "Rahul Kumar",
			Department:  "Finance",
			DepositDate: today,
		},
	}

	_, err = s.svc.RecordEMDPayment(ctx, "bid-123", payReq, "user-exec", []string{"BID_EXECUTIVE"})
	if err == nil {
		t.Fatal("expected error when BID_EXECUTIVE tries to record EMD payment")
	}

	// Authorized role (ADMIN, SUPER_ADMIN, FINANCE) should succeed
	adminResp, err := s.svc.UpdateBasicEMD(ctx, "bid-123", &domain.UpdateBasicEMDRequest{
		EMDAmount: float64Ptr(50000),
		Purpose:   strPtr("Updated by Admin"),
	}, "user-admin", []string{"ADMIN"})
	if err != nil {
		t.Fatalf("expected ADMIN to succeed, got %v", err)
	}
	if adminResp == nil {
		t.Fatal("expected response for ADMIN")
	}
}
