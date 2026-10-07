package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/bid/domain"
)

func hasRole(roles []string, target string) bool {
	return hasAnyRole(roles, target)
}

func strPtr(s string) *string {
	return &s
}

func parseDateFlexible(val string) (*time.Time, error) {
	val = strings.TrimSpace(val)
	if val == "" {
		return nil, nil
	}
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02 15:04:05",
		"2006-01-02",
		"02-Jan-2006",
		"02-01-2006",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, val); err == nil {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("invalid date format: %s", val)
}

// ────────────────────────────────────────
// EMD Lifecycle Service Implementation
// ────────────────────────────────────────

func (s *bidService) GetEMDDetails(ctx context.Context, bidID string) (*domain.TenderEMDResponse, error) {
	emd, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}
	return s.enrichEMDResponse(ctx, emd)
}

func (s *bidService) UpdateBasicEMD(ctx context.Context, bidID string, req *domain.UpdateBasicEMDRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	// Rule: Maintained by Finance users only (or Admin/Super Admin)
	if !hasAnyRole(actorRoles, "FINANCE", "ADMIN", "SUPER_ADMIN") {
		return nil, fmt.Errorf("%w: only Finance team or Administrators can modify EMD details", domain.ErrForbidden)
	}

	// Validation Rule 1: EMD Amount cannot be empty or zero
	if req.EMDAmount != nil && *req.EMDAmount <= 0 {
		return nil, fmt.Errorf("%w: EMD amount must be greater than zero", domain.ErrValidation)
	}

	emd, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}

	if req.EMDAmount != nil {
		emd.EMDAmount = *req.EMDAmount
		// Sync with bid_workspaces
		_ = s.repo.Update(ctx, bidID, &domain.UpdateBidRequest{
			EMDAmount: req.EMDAmount,
		})
	}
	if req.DueDate != nil {
		t, err := parseDateFlexible(*req.DueDate)
		if err != nil {
			return nil, fmt.Errorf("%w: due date: %v", domain.ErrValidation, err)
		}
		emd.DueDate = t
	}
	if req.ReferenceNumber != nil {
		emd.ReferenceNumber = req.ReferenceNumber
	}
	if req.Purpose != nil {
		emd.Purpose = req.Purpose
	}
	if req.Status != nil && *req.Status != "" {
		// Prevent Finance from marking as MD Approved directly
		if strings.EqualFold(*req.Status, domain.EMDStatusApproved) || strings.EqualFold(*req.Status, domain.EMDStatusMDApproved) {
			if !hasAnyRole(actorRoles, "ADMIN", "SUPER_ADMIN") {
				return nil, fmt.Errorf("%w: Finance cannot mark EMD as MD Approved", domain.ErrForbidden)
			}
		}
		emd.Status = *req.Status
	}
	if req.Remarks != nil {
		emd.Remarks = req.Remarks
	}

	emd.UpdatedBy = &actorID
	if err := s.repo.UpsertEMDDetails(ctx, emd); err != nil {
		return nil, err
	}

	actorSummary, _ := s.repo.GetUserSummary(ctx, actorID)
	actorName := "System"
	if actorSummary != nil {
		actorName = actorSummary.FullName
	}

	_ = s.repo.LogEMDAction(ctx, &domain.TenderEMDAuditLog{
		BidID:     bidID,
		EMDID:     emd.ID,
		Action:    domain.EMDActionUpdated,
		ActorID:   &actorID,
		ActorName: &actorName,
		ActorRole: &actorRoles[0],
		Remarks:   req.Remarks,
	})

	return s.enrichEMDResponse(ctx, emd)
}

func (s *bidService) SubmitEMDForMDApproval(ctx context.Context, bidID string, req *domain.SubmitMDApprovalRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	// Rule: Submitted by Finance Manager
	if !hasRole(actorRoles, "FINANCE") && !hasAnyRole(actorRoles, "ADMIN", "SUPER_ADMIN") {
		return nil, fmt.Errorf("%w: only Finance team can submit EMD for MD approval", domain.ErrForbidden)
	}

	emd, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}

	// Validate required information before submitting
	if emd.EMDAmount <= 0 {
		return nil, fmt.Errorf("%w: EMD amount must be greater than zero before submitting for MD approval", domain.ErrValidation)
	}
	if emd.DueDate == nil {
		return nil, fmt.Errorf("%w: EMD due date is required before submitting for MD approval", domain.ErrValidation)
	}
	if emd.ReferenceNumber == nil || strings.TrimSpace(*emd.ReferenceNumber) == "" {
		return nil, fmt.Errorf("%w: EMD reference number is required before submitting for MD approval", domain.ErrValidation)
	}
	if emd.Purpose == nil || strings.TrimSpace(*emd.Purpose) == "" {
		return nil, fmt.Errorf("%w: EMD purpose is required before submitting for MD approval", domain.ErrValidation)
	}

	now := time.Now()
	emd.Status = domain.EMDStatusPendingMDApproval
	emd.MDSubmittedBy = &actorID
	emd.MDSubmittedAt = &now
	emd.UpdatedBy = &actorID
	if req != nil && req.Remarks != nil && *req.Remarks != "" {
		emd.Remarks = req.Remarks
	}

	if err := s.repo.UpsertEMDDetails(ctx, emd); err != nil {
		return nil, err
	}

	actorSummary, _ := s.repo.GetUserSummary(ctx, actorID)
	actorName := "Finance Manager"
	if actorSummary != nil {
		actorName = actorSummary.FullName
	}

	remarksStr := ""
	if req != nil && req.Remarks != nil {
		remarksStr = *req.Remarks
	}

	_ = s.repo.LogEMDAction(ctx, &domain.TenderEMDAuditLog{
		BidID:     bidID,
		EMDID:     emd.ID,
		Action:    domain.EMDActionSubmittedMDApproval,
		ActorID:   &actorID,
		ActorName: &actorName,
		ActorRole: &actorRoles[0],
		Remarks:   &remarksStr,
	})

	// Log stage micro event
	bid, _ := s.repo.GetByID(ctx, bidID)
	bidTitle := "Tender"
	if bid != nil {
		bidTitle = bid.Title
	}

	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            bidID,
		ToStage:          domain.StageEMDProcessing,
		EventType:        strPtr("EMD_MD_APPROVAL"),
		TransitionReason: strPtr(fmt.Sprintf("EMD submitted for MD Approval by %s (Amount: ₹%.2f)", actorName, emd.EMDAmount)),
		TransitionedBy:   actorID,
	})

	// Notify MD / Super Admin & Admin via alert
	_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
		TargetRole: "SUPER_ADMIN",
		BidID:      &bidID,
		CreatedBy:  &actorID,
		Type:       "ACTION_REQUIRED",
		Title:      fmt.Sprintf("EMD Approval Required — %s", bidTitle),
		Message:    fmt.Sprintf("<p>EMD details of <strong>₹%.2f</strong> have been verified and submitted by %s for MD Approval.</p>", emd.EMDAmount, actorName),
	})

	return s.enrichEMDResponse(ctx, emd)
}

func (s *bidService) ApproveEMD(ctx context.Context, bidID string, req *domain.MDDecisionRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	// Rule: MD acts as Admin / Super Admin
	if !hasAnyRole(actorRoles, "SUPER_ADMIN", "ADMIN") {
		return nil, fmt.Errorf("%w: only Managing Director (Admin/Super Admin) can approve EMD", domain.ErrForbidden)
	}

	emd, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	emd.Status = domain.EMDStatusMDApproved
	emd.MDDecidedBy = &actorID
	emd.MDDecidedAt = &now
	if req != nil && strings.TrimSpace(req.Remarks) != "" {
		emd.MDDecisionRemarks = &req.Remarks
	}
	emd.UpdatedBy = &actorID

	if err := s.repo.UpsertEMDDetails(ctx, emd); err != nil {
		return nil, err
	}

	actorSummary, _ := s.repo.GetUserSummary(ctx, actorID)
	actorName := "Managing Director"
	if actorSummary != nil {
		actorName = actorSummary.FullName
	}

	remarksStr := ""
	if req != nil {
		remarksStr = req.Remarks
	}

	_ = s.repo.LogEMDAction(ctx, &domain.TenderEMDAuditLog{
		BidID:     bidID,
		EMDID:     emd.ID,
		Action:    domain.EMDActionMDApproved,
		ActorID:   &actorID,
		ActorName: &actorName,
		ActorRole: &actorRoles[0],
		Remarks:   &remarksStr,
	})

	// Log stage micro event
	bid, _ := s.repo.GetByID(ctx, bidID)
	bidTitle := "Tender"
	if bid != nil {
		bidTitle = bid.Title
	}

	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            bidID,
		ToStage:          domain.StageEMDProcessing,
		EventType:        strPtr("EMD_MD_APPROVED"),
		TransitionReason: strPtr(fmt.Sprintf("EMD approved by MD (%s). Payment unlocked.", actorName)),
		TransitionedBy:   actorID,
	})

	// Alert Finance team that payment entry is now unlocked
	_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
		TargetRole: "FINANCE",
		BidID:      &bidID,
		CreatedBy:  &actorID,
		Type:       "EMD",
		Title:      fmt.Sprintf("EMD Approved by MD — %s", bidTitle),
		Message:    fmt.Sprintf("<p>EMD of <strong>₹%.2f</strong> was approved by %s. Finance can now proceed to execute payment and enter payment details.</p>", emd.EMDAmount, actorName),
	})

	return s.enrichEMDResponse(ctx, emd)
}

func (s *bidService) RejectEMD(ctx context.Context, bidID string, req *domain.MDDecisionRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	// Rule: MD acts as Admin / Super Admin
	if !hasAnyRole(actorRoles, "SUPER_ADMIN", "ADMIN") {
		return nil, fmt.Errorf("%w: only Managing Director (Admin/Super Admin) can reject EMD", domain.ErrForbidden)
	}

	if req == nil || strings.TrimSpace(req.Remarks) == "" {
		return nil, fmt.Errorf("%w: rejection reason is mandatory", domain.ErrValidation)
	}

	emd, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	emd.Status = domain.EMDStatusRejected
	emd.MDDecidedBy = &actorID
	emd.MDDecidedAt = &now
	emd.MDDecisionRemarks = &req.Remarks
	emd.UpdatedBy = &actorID

	if err := s.repo.UpsertEMDDetails(ctx, emd); err != nil {
		return nil, err
	}

	actorSummary, _ := s.repo.GetUserSummary(ctx, actorID)
	actorName := "Managing Director"
	if actorSummary != nil {
		actorName = actorSummary.FullName
	}

	_ = s.repo.LogEMDAction(ctx, &domain.TenderEMDAuditLog{
		BidID:     bidID,
		EMDID:     emd.ID,
		Action:    domain.EMDActionMDRejected,
		ActorID:   &actorID,
		ActorName: &actorName,
		ActorRole: &actorRoles[0],
		Remarks:   &req.Remarks,
	})

	// Log stage micro event
	bid, _ := s.repo.GetByID(ctx, bidID)
	bidTitle := "Tender"
	if bid != nil {
		bidTitle = bid.Title
	}

	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            bidID,
		ToStage:          domain.StageEMDProcessing,
		EventType:        strPtr("EMD_MD_REJECTED"),
		TransitionReason: strPtr(fmt.Sprintf("EMD rejected by MD (%s): %s", actorName, req.Remarks)),
		TransitionedBy:   actorID,
	})

	// Alert Finance team
	_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
		TargetRole: "FINANCE",
		BidID:      &bidID,
		CreatedBy:  &actorID,
		Type:       "ACTION_REQUIRED",
		Title:      fmt.Sprintf("EMD Rejected by MD — %s", bidTitle),
		Message:    fmt.Sprintf("<p>EMD was rejected by %s with remark: <em>%s</em>. Returned to Finance for correction.</p>", actorName, req.Remarks),
	})

	return s.enrichEMDResponse(ctx, emd)
}

func (s *bidService) RecordEMDPayment(ctx context.Context, bidID string, req *domain.RecordEMDPaymentRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	// Rule: Payment details maintained by Finance users only
	if !hasRole(actorRoles, "FINANCE") && !hasAnyRole(actorRoles, "ADMIN", "SUPER_ADMIN") {
		return nil, fmt.Errorf("%w: only Finance team can enter EMD payment details", domain.ErrForbidden)
	}

	emd, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}

	// Validation Rule 2: Payment Amount must be positive and must strictly match EMD Amount (not less, not greater)
	if req.PaymentAmount <= 0 {
		return nil, fmt.Errorf("%w: payment amount must be greater than zero", domain.ErrValidation)
	}
	if emd.EMDAmount > 0 {
		if req.PaymentAmount < emd.EMDAmount {
			return nil, fmt.Errorf("%w: payment amount (₹%.2f) cannot be less than required EMD amount (₹%.2f)", domain.ErrValidation, req.PaymentAmount, emd.EMDAmount)
		}
		if req.PaymentAmount > emd.EMDAmount {
			return nil, fmt.Errorf("%w: payment amount (₹%.2f) cannot be greater than required EMD amount (₹%.2f)", domain.ErrValidation, req.PaymentAmount, emd.EMDAmount)
		}
	} else {
		emd.EMDAmount = req.PaymentAmount
	}

	// Validation Rule 7: Payment Date cannot be invalid or future-dated
	payDate, err := parseDateFlexible(req.PaymentDate)
	if err != nil {
		return nil, fmt.Errorf("%w: payment date: %v", domain.ErrValidation, err)
	}
	if payDate.After(time.Now().Add(24 * time.Hour)) {
		return nil, fmt.Errorf("%w: payment date cannot be future-dated", domain.ErrValidation)
	}

	// Mode-specific validations (Rules 4, 5, 6, 11)
	var paymentDetailsBytes []byte
	var refNumber string

	switch req.PaymentMode {
	case domain.PaymentModeOnline:
		if req.OnlineDetails == nil {
			return nil, fmt.Errorf("%w: online payment details are required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.OnlineDetails.TransactionID) == "" {
			return nil, fmt.Errorf("%w: transaction ID / UTR number is required for online payment", domain.ErrValidation)
		}
		if strings.TrimSpace(req.OnlineDetails.PaymentGateway) == "" {
			return nil, fmt.Errorf("%w: payment gateway is required for online payment", domain.ErrValidation)
		}
		if strings.TrimSpace(req.OnlineDetails.TransactionDateTime) == "" {
			return nil, fmt.Errorf("%w: transaction date and time is required for online payment", domain.ErrValidation)
		}
		refNumber = req.OnlineDetails.TransactionID
		req.OnlineDetails.PaymentAmount = req.PaymentAmount
		paymentDetailsBytes, _ = json.Marshal(req.OnlineDetails)

	case domain.PaymentModeCheque:
		if req.ChequeDetails == nil {
			return nil, fmt.Errorf("%w: cheque payment details are required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChequeDetails.ChequeNumber) == "" {
			return nil, fmt.Errorf("%w: cheque number is required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChequeDetails.ChequeDate) == "" {
			return nil, fmt.Errorf("%w: cheque date is required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChequeDetails.BankName) == "" {
			return nil, fmt.Errorf("%w: bank name is required for cheque payment", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChequeDetails.SubmissionDate) == "" {
			return nil, fmt.Errorf("%w: cheque submission date is required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChequeDetails.ChequeStatus) == "" {
			req.ChequeDetails.ChequeStatus = domain.ChequeStatusSubmitted
		}
		refNumber = req.ChequeDetails.ChequeNumber
		req.ChequeDetails.Amount = req.PaymentAmount
		paymentDetailsBytes, _ = json.Marshal(req.ChequeDetails)

	case domain.PaymentModeChallan:
		if req.ChallanDetails == nil {
			return nil, fmt.Errorf("%w: challan payment details are required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChallanDetails.ChallanNumber) == "" {
			return nil, fmt.Errorf("%w: challan number is required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChallanDetails.ChallanDate) == "" {
			return nil, fmt.Errorf("%w: challan date is required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChallanDetails.BankName) == "" {
			return nil, fmt.Errorf("%w: bank name is required for challan payment", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChallanDetails.ChallanType) == "" {
			return nil, fmt.Errorf("%w: challan type/purpose is required", domain.ErrValidation)
		}
		if strings.TrimSpace(req.ChallanDetails.ChallanStatus) == "" {
			req.ChallanDetails.ChallanStatus = domain.ChallanStatusSubmitted
		}
		refNumber = req.ChallanDetails.ChallanNumber
		req.ChallanDetails.Amount = req.PaymentAmount
		paymentDetailsBytes, _ = json.Marshal(req.ChallanDetails)

	default:
		return nil, fmt.Errorf("%w: invalid payment mode: %s", domain.ErrValidation, req.PaymentMode)
	}

	// Depositor / Person Details validation (Section 10)
	if strings.TrimSpace(req.Depositor.Name) == "" {
		return nil, fmt.Errorf("%w: depositor person name is required", domain.ErrValidation)
	}
	if strings.TrimSpace(req.Depositor.Department) == "" {
		return nil, fmt.Errorf("%w: depositor department is required", domain.ErrValidation)
	}
	depDate, err := parseDateFlexible(req.Depositor.DepositDate)
	if err != nil {
		return nil, fmt.Errorf("%w: depositor deposit date: %v", domain.ErrValidation, err)
	}

	if req.PaymentReference != nil && *req.PaymentReference != "" {
		refNumber = *req.PaymentReference
	}

	now := time.Now()
	emd.PaymentMode = &req.PaymentMode
	emd.PaymentAmount = &req.PaymentAmount
	emd.PaymentDate = payDate
	emd.PaymentStatus = &req.PaymentStatus
	emd.PaymentReference = &refNumber
	emd.PaymentDetails = paymentDetailsBytes
	emd.PaymentReceiptURL = req.PaymentReceiptURL
	emd.PaymentEnteredBy = &actorID
	emd.PaymentEnteredAt = &now

	// Depositor fields
	emd.DepositorName = &req.Depositor.Name
	emd.DepositorEmployeeID = req.Depositor.EmployeeID
	emd.DepositorDepartment = &req.Depositor.Department
	emd.DepositorDesignation = req.Depositor.Designation
	emd.DepositorContact = req.Depositor.ContactNumber
	emd.DepositorEmail = req.Depositor.EmailID
	emd.DepositDate = depDate
	emd.DepositorRemarks = req.Depositor.Remarks

	// Update EMD status to Paid directly without asking permission for MD
	emd.Status = domain.EMDStatusPaid
	emd.UpdatedBy = &actorID
	if emd.MDDecidedAt == nil {
		emd.MDDecidedAt = &now
		emd.MDDecidedBy = &actorID
		mdDirectRemarks := "Payment recorded directly by Finance"
		emd.MDDecisionRemarks = &mdDirectRemarks
	}

	if err := s.repo.UpsertEMDDetails(ctx, emd); err != nil {
		return nil, err
	}

	// Sync with bid_workspaces: mark emd_ready = true
	nowStr := now.Format(time.RFC3339)
	readyBool := true
	_ = s.repo.Update(ctx, bidID, &domain.UpdateBidRequest{
		EMDReady:     &readyBool,
		EMDReadyDate: &nowStr,
	})

	actorSummary, _ := s.repo.GetUserSummary(ctx, actorID)
	actorName := "Finance Manager"
	if actorSummary != nil {
		actorName = actorSummary.FullName
	}

	_ = s.repo.LogEMDAction(ctx, &domain.TenderEMDAuditLog{
		BidID:     bidID,
		EMDID:     emd.ID,
		Action:    domain.EMDActionPaymentRecorded,
		ActorID:   &actorID,
		ActorName: &actorName,
		ActorRole: &actorRoles[0],
		Remarks:   strPtr(fmt.Sprintf("Payment of ₹%.2f recorded via %s (Ref: %s) by %s", req.PaymentAmount, req.PaymentMode, refNumber, req.Depositor.Name)),
		Details:   paymentDetailsBytes,
	})

	// Log stage micro event
	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            bidID,
		ToStage:          domain.StageEMDProcessing,
		EventType:        strPtr("EMD_PAYMENT"),
		TransitionReason: strPtr(fmt.Sprintf("EMD payment completed: ₹%.2f via %s by %s", req.PaymentAmount, req.PaymentMode, req.Depositor.Name)),
		TransitionedBy:   actorID,
	})

	return s.enrichEMDResponse(ctx, emd)
}

func (s *bidService) VerifyEMDPayment(ctx context.Context, bidID string, req *domain.VerifyEMDPaymentRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	// Rule: Verification by Finance Manager
	if !hasRole(actorRoles, "FINANCE") && !hasAnyRole(actorRoles, "ADMIN", "SUPER_ADMIN") {
		return nil, fmt.Errorf("%w: only Finance team can verify EMD payments", domain.ErrForbidden)
	}

	emd, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}

	if emd.PaymentAmount == nil || *emd.PaymentAmount <= 0 {
		return nil, fmt.Errorf("%w: cannot verify EMD before payment details are recorded", domain.ErrValidation)
	}

	now := time.Now()
	emd.VerificationStatus = req.Status
	emd.VerificationRemarks = req.Remarks
	emd.VerifiedBy = &actorID
	emd.VerifiedAt = &now
	emd.UpdatedBy = &actorID

	if req.Status == "Verified" {
		emd.Status = domain.EMDStatusVerified
	} else if req.Status == "Rejected" {
		// Verification rejected
		emd.Status = "Verification Rejected"
	}

	if err := s.repo.UpsertEMDDetails(ctx, emd); err != nil {
		return nil, err
	}

	actorSummary, _ := s.repo.GetUserSummary(ctx, actorID)
	actorName := "Finance Manager"
	if actorSummary != nil {
		actorName = actorSummary.FullName
	}

	actionType := domain.EMDActionVerified
	if req.Status == "Rejected" {
		actionType = domain.EMDActionVerificationRejected
	}

	_ = s.repo.LogEMDAction(ctx, &domain.TenderEMDAuditLog{
		BidID:     bidID,
		EMDID:     emd.ID,
		Action:    actionType,
		ActorID:   &actorID,
		ActorName: &actorName,
		ActorRole: &actorRoles[0],
		Remarks:   req.Remarks,
	})

	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            bidID,
		ToStage:          domain.StageEMDProcessing,
		EventType:        strPtr("EMD_VERIFICATION"),
		TransitionReason: strPtr(fmt.Sprintf("EMD payment verification status set to %s by %s", req.Status, actorName)),
		TransitionedBy:   actorID,
	})

	return s.enrichEMDResponse(ctx, emd)
}

func (s *bidService) UpdateEMDRefund(ctx context.Context, bidID string, req *domain.UpdateEMDRefundRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	// Rule: Release/Refund updated by Finance
	if !hasRole(actorRoles, "FINANCE") && !hasAnyRole(actorRoles, "ADMIN", "SUPER_ADMIN") {
		return nil, fmt.Errorf("%w: only Finance team can update EMD release/refund information", domain.ErrForbidden)
	}

	emd, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}

	// Validation Rule 8: Refund Amount cannot exceed EMD Amount
	if req.RefundAmount != nil && *req.RefundAmount > 0 {
		if emd.EMDAmount > 0 && *req.RefundAmount > emd.EMDAmount {
			return nil, fmt.Errorf("%w: refund amount (₹%.2f) cannot exceed eligible EMD amount (₹%.2f)", domain.ErrValidation, *req.RefundAmount, emd.EMDAmount)
		}
		emd.RefundAmount = req.RefundAmount
	}

	// Validation Rule 9: Actual Refund Date is mandatory when Refund Status is Refunded
	if req.RefundStatus == domain.RefundStatusRefunded {
		if req.ActualRefundDate == nil || strings.TrimSpace(*req.ActualRefundDate) == "" {
			return nil, fmt.Errorf("%w: actual refund date is mandatory when refund status is Refunded", domain.ErrValidation)
		}
	}

	// Validation Rule 10: Refund Reference/UTR is mandatory for online refunds
	if req.RefundMode != nil && strings.EqualFold(*req.RefundMode, "Online") && req.RefundStatus == domain.RefundStatusRefunded {
		if (req.RefundTransactionID == nil || strings.TrimSpace(*req.RefundTransactionID) == "") &&
			(req.RefundReferenceNumber == nil || strings.TrimSpace(*req.RefundReferenceNumber) == "") {
			return nil, fmt.Errorf("%w: transaction ID/UTR is mandatory for online refunds", domain.ErrValidation)
		}
	}

	if req.ExpectedRefundDate != nil {
		t, err := parseDateFlexible(*req.ExpectedRefundDate)
		if err != nil {
			return nil, fmt.Errorf("%w: expected refund date: %v", domain.ErrValidation, err)
		}
		emd.ExpectedRefundDate = t
	}
	if req.ActualRefundDate != nil {
		t, err := parseDateFlexible(*req.ActualRefundDate)
		if err != nil {
			return nil, fmt.Errorf("%w: actual refund date: %v", domain.ErrValidation, err)
		}
		emd.ActualRefundDate = t
	}

	emd.RefundStatus = req.RefundStatus
	if req.RefundReferenceNumber != nil {
		emd.RefundReferenceNo = req.RefundReferenceNumber
	}
	if req.RefundTransactionID != nil {
		emd.RefundTransactionID = req.RefundTransactionID
	}
	if req.RefundMode != nil {
		emd.RefundMode = req.RefundMode
	}
	if req.RefundRemarks != nil {
		emd.RefundRemarks = req.RefundRemarks
	}
	if req.RefundReceiptURL != nil {
		emd.RefundReceiptURL = req.RefundReceiptURL
	}

	now := time.Now()
	emd.RefundUpdatedBy = &actorID
	emd.RefundUpdatedAt = &now
	emd.UpdatedBy = &actorID

	// Update overall EMD status if Refunded or Released
	if req.RefundStatus == domain.RefundStatusRefunded {
		emd.Status = domain.EMDStatusRefunded
		// Sync with bid_workspaces
		returnedBool := true
		nowStr := now.Format(time.RFC3339)
		_ = s.repo.Update(ctx, bidID, &domain.UpdateBidRequest{
			EMDReturned:     &returnedBool,
			EMDReturnedDate: &nowStr,
		})
	} else if req.RefundStatus == domain.RefundStatusReleased {
		emd.Status = domain.EMDStatusReleased
	}

	if err := s.repo.UpsertEMDDetails(ctx, emd); err != nil {
		return nil, err
	}

	actorSummary, _ := s.repo.GetUserSummary(ctx, actorID)
	actorName := "Finance Manager"
	if actorSummary != nil {
		actorName = actorSummary.FullName
	}

	_ = s.repo.LogEMDAction(ctx, &domain.TenderEMDAuditLog{
		BidID:     bidID,
		EMDID:     emd.ID,
		Action:    domain.EMDActionRefundUpdated,
		ActorID:   &actorID,
		ActorName: &actorName,
		ActorRole: &actorRoles[0],
		Remarks:   req.RefundRemarks,
	})

	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            bidID,
		ToStage:          domain.StageAwardHandover,
		EventType:        strPtr("EMD_REFUND"),
		TransitionReason: strPtr(fmt.Sprintf("EMD refund status updated to %s by %s", req.RefundStatus, actorName)),
		TransitionedBy:   actorID,
	})

	return s.enrichEMDResponse(ctx, emd)
}

func (s *bidService) GetEMDAuditLogs(ctx context.Context, bidID string) ([]domain.TenderEMDAuditLog, error) {
	return s.repo.GetEMDAuditLogs(ctx, bidID)
}

// ────────────────────────────────────────
// Helper to enrich response with user summaries
// ────────────────────────────────────────

func (s *bidService) enrichEMDResponse(ctx context.Context, emd *domain.TenderEMDDetails) (*domain.TenderEMDResponse, error) {
	resp := &domain.TenderEMDResponse{
		ID:                  emd.ID,
		BidID:               emd.BidID,
		EMDAmount:           emd.EMDAmount,
		DueDate:             emd.DueDate,
		ReferenceNumber:     emd.ReferenceNumber,
		Purpose:             emd.Purpose,
		Status:              emd.Status,
		Remarks:             emd.Remarks,
		PaymentMode:         emd.PaymentMode,
		PaymentAmount:       emd.PaymentAmount,
		PaymentDate:         emd.PaymentDate,
		PaymentStatus:       emd.PaymentStatus,
		PaymentReference:    emd.PaymentReference,
		PaymentDetails:      emd.PaymentDetails,
		PaymentReceiptURL:   emd.PaymentReceiptURL,
		PaymentEnteredAt:    emd.PaymentEnteredAt,
		DepositorName:       emd.DepositorName,
		DepositorEmployeeID: emd.DepositorEmployeeID,
		DepositorDepartment: emd.DepositorDepartment,
		DepositorDesignation: emd.DepositorDesignation,
		DepositorContact:    emd.DepositorContact,
		DepositorEmail:      emd.DepositorEmail,
		DepositDate:         emd.DepositDate,
		DepositorRemarks:    emd.DepositorRemarks,
		VerificationStatus:  emd.VerificationStatus,
		VerificationRemarks: emd.VerificationRemarks,
		VerifiedAt:          emd.VerifiedAt,
		MDSubmittedAt:       emd.MDSubmittedAt,
		MDDecidedAt:         emd.MDDecidedAt,
		MDDecisionRemarks:   emd.MDDecisionRemarks,
		RefundStatus:        emd.RefundStatus,
		ExpectedRefundDate:  emd.ExpectedRefundDate,
		ActualRefundDate:    emd.ActualRefundDate,
		RefundAmount:        emd.RefundAmount,
		RefundReferenceNo:   emd.RefundReferenceNo,
		RefundTransactionID: emd.RefundTransactionID,
		RefundMode:          emd.RefundMode,
		RefundRemarks:       emd.RefundRemarks,
		RefundReceiptURL:    emd.RefundReceiptURL,
		RefundUpdatedAt:     emd.RefundUpdatedAt,
		CreatedAt:           emd.CreatedAt,
		UpdatedAt:           emd.UpdatedAt,
		IsMDApproved:        emd.Status == domain.EMDStatusApproved || emd.Status == domain.EMDStatusMDApproved || emd.Status == domain.EMDStatusPaid || emd.Status == domain.EMDStatusVerified || emd.Status == domain.EMDStatusReleased || emd.Status == domain.EMDStatusRefunded || emd.MDDecidedAt != nil,
		IsPaid:              emd.Status == domain.EMDStatusPaid || emd.Status == domain.EMDStatusVerified || emd.Status == domain.EMDStatusReleased || emd.Status == domain.EMDStatusRefunded,
		IsVerified:          emd.VerificationStatus == domain.VerificationStatusVerified,
		IsRefunded:          emd.RefundStatus == domain.RefundStatusRefunded,
	}

	// Lookup user summaries
	if emd.CreatedBy != nil {
		resp.CreatedBy, _ = s.repo.GetUserSummary(ctx, *emd.CreatedBy)
	}
	if emd.UpdatedBy != nil {
		resp.UpdatedBy, _ = s.repo.GetUserSummary(ctx, *emd.UpdatedBy)
	}
	if emd.PaymentEnteredBy != nil {
		resp.PaymentEnteredBy, _ = s.repo.GetUserSummary(ctx, *emd.PaymentEnteredBy)
	}
	if emd.VerifiedBy != nil {
		resp.VerifiedBy, _ = s.repo.GetUserSummary(ctx, *emd.VerifiedBy)
	}
	if emd.MDSubmittedBy != nil {
		resp.MDSubmittedBy, _ = s.repo.GetUserSummary(ctx, *emd.MDSubmittedBy)
	}
	if emd.MDDecidedBy != nil {
		resp.MDDecidedBy, _ = s.repo.GetUserSummary(ctx, *emd.MDDecidedBy)
	}
	if emd.RefundUpdatedBy != nil {
		resp.RefundUpdatedBy, _ = s.repo.GetUserSummary(ctx, *emd.RefundUpdatedBy)
	}

	return resp, nil
}
