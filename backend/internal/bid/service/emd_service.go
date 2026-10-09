package service

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"math"
	"regexp"
	"strings"
	"time"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/bid/domain"
)

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

func emdInvalid(format string, a ...any) error {
	return fmt.Errorf("%w: %s", domain.ErrValidation, fmt.Sprintf(format, a...))
}

func emdForbidden(format string, a ...any) error {
	return fmt.Errorf("%w: %s", domain.ErrForbidden, fmt.Sprintf(format, a...))
}

// Money is compared in integer paise so 0.1+0.2 style drift never decides a
// payment or refund check.
func paise(v float64) int64 { return int64(math.Round(v * 100)) }

func round2(v float64) float64 { return float64(paise(v)) / 100 }

func emdAmount(bid *domain.BidWorkspace) float64 {
	if bid.EMDAmount == nil {
		return 0
	}
	return round2(*bid.EMDAmount)
}

func isFinanceOrAdmin(roles []string) bool {
	return hasAnyRole(roles, "FINANCE", "ADMIN", "SUPER_ADMIN")
}

func isAdminRole(roles []string) bool {
	return hasAnyRole(roles, "ADMIN", "SUPER_ADMIN")
}

// emdAwaitingApproval: the MD sign-off is outstanding (or was refused), so
// Finance may not declare the EMD ready.
func emdAwaitingApproval(status string) bool {
	return status == domain.EMDStatusPendingMDApproval || status == domain.EMDStatusRejected
}

func emdIsApproved(status string) bool {
	switch status {
	case domain.EMDStatusApproved, domain.EMDStatusMDApproved, domain.EMDStatusPaid, domain.EMDStatusVerified,
		domain.EMDStatusVerificationRejected, domain.EMDStatusReleased, domain.EMDStatusRefunded:
		return true
	}
	return false
}

func emdIsPaid(status string) bool {
	switch status {
	case domain.EMDStatusPaid, domain.EMDStatusVerified, domain.EMDStatusReleased, domain.EMDStatusRefunded:
		return true
	}
	return false
}

var validRefundStatuses = map[string]bool{
	domain.RefundStatusNA: true, domain.RefundStatusPending: true, domain.RefundStatusInitiated: true,
	domain.RefundStatusReleased: true, domain.RefundStatusRefunded: true, domain.RefundStatusFailed: true,
}

// defaultEMD is the in-memory lifecycle view of a tender that has no row yet;
// it is only persisted by the first mutation.
func defaultEMD(bid *domain.BidWorkspace) *domain.TenderEMDDetails {
	ref := ""
	if bid.GemBidNo != nil && *bid.GemBidNo != "" {
		ref = *bid.GemBidNo
	} else if bid.BidNo != nil {
		ref = *bid.BidNo
	}
	mode := domain.PaymentModeOnline
	if bid.EMDType != nil && *bid.EMDType == "DD" {
		mode = domain.PaymentModeCheque
	}
	// A tender already marked ready through the old button counts as paid.
	status, refund := domain.EMDStatusPending, domain.RefundStatusNA
	if bid.EMDReady {
		status, refund = domain.EMDStatusPaid, domain.RefundStatusPending
	}
	return &domain.TenderEMDDetails{
		BidID:              bid.ID,
		EMDAmount:          emdAmount(bid),
		DueDate:            bid.ClosingDate,
		ReferenceNumber:    &ref,
		Purpose:            strPtr("Tender EMD for " + bid.Title),
		Status:             status,
		PaymentMode:        &mode,
		PaymentDetails:     []byte("{}"),
		VerificationStatus: domain.VerificationStatusPending,
		RefundStatus:       refund,
		CreatedBy:          &bid.CreatedBy,
		UpdatedBy:          &bid.CreatedBy,
	}
}

// emdView is the lifecycle as a reader sees it: the stored row (or the
// default), the amount taken from the tender, and a closed row reopened.
func emdView(bid *domain.BidWorkspace, stored *domain.TenderEMDDetails) *domain.TenderEMDDetails {
	emd := stored
	if emd == nil {
		emd = defaultEMD(bid)
	}
	emd.EMDAmount = emdAmount(bid)
	if emd.Status == domain.EMDStatusNotApplicable {
		emd.Status = domain.EMDStatusPending
	}
	return emd
}

// exemptEMDView is the read-only payload for a tender that needs no EMD.
func exemptEMDView(bid *domain.BidWorkspace) *domain.TenderEMDResponse {
	status := domain.EMDStatusNotApplicable
	if bid.EMDExempted {
		status = domain.EMDStatusExempted
	}
	return &domain.TenderEMDResponse{
		BidID:              bid.ID,
		EMDAmount:          emdAmount(bid),
		Status:             status,
		VerificationStatus: domain.VerificationStatusPending,
		RefundStatus:       domain.RefundStatusNA,
		ExemptionType:      bid.EMDExemptionType,
		ExemptionReason:    bid.EMDExemptionReason,
	}
}

// validateReceiptURL allows only a link to a receipt uploaded for this very
// tender, which rules out javascript: URLs and other tenders' files.
func validateReceiptURL(bidID string, u *string) error {
	if u == nil || *u == "" {
		return nil
	}
	if !regexp.MustCompile(`^/api/v1/bids/` + regexp.QuoteMeta(bidID) + `/emd/receipt/[0-9a-f]{32}\.(jpg|png|webp|pdf)$`).MatchString(*u) {
		return emdInvalid("receipt URL is not a valid uploaded receipt for this tender")
	}
	return nil
}

func (s *bidService) EnsureEMDRequired(ctx context.Context, bidID string) error {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return err
	}
	if emdNotRequired(bid) {
		return emdInvalid("EMD is exempted or not applicable for this tender")
	}
	return nil
}

func (s *bidService) GetEMDDetails(ctx context.Context, bidID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return nil, err
	}
	if emdNotRequired(bid) {
		return exemptEMDView(bid), nil
	}
	stored, err := s.repo.GetEMDDetails(ctx, bidID)
	if err != nil {
		return nil, err
	}
	resp := s.enrichEMDResponse(ctx, emdView(bid, stored))
	if isFinanceOrAdmin(actorRoles) {
		return resp, nil
	}
	return &domain.TenderEMDResponse{
		ID: resp.ID, BidID: resp.BidID, EMDAmount: resp.EMDAmount, Status: resp.Status,
		VerificationStatus: resp.VerificationStatus, RefundStatus: resp.RefundStatus,
		CreatedAt: resp.CreatedAt, UpdatedAt: resp.UpdatedAt,
		IsMDApproved: resp.IsMDApproved, IsPaid: resp.IsPaid,
	}, nil
}

func (s *bidService) GetEMDAuditLogs(ctx context.Context, bidID string) ([]domain.TenderEMDAuditLog, error) {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return nil, err
	}
	if emdNotRequired(bid) {
		return []domain.TenderEMDAuditLog{}, nil
	}
	return s.repo.GetEMDAuditLogs(ctx, bidID)
}

// emdOp is the state one EMD mutation works on, inside the row lock.
type emdOp struct {
	bid       *domain.BidWorkspace
	emd       *domain.TenderEMDDetails
	actorID   string
	roles     []string
	actorName string
	now       time.Time
}

// mutateEMD runs apply under a row lock and commits the change, its audit
// entry and any bid flag writes together. The tender must need an EMD.
func (s *bidService) mutateEMD(ctx context.Context, bidID, actorID string, roles []string, apply func(tx domain.EMDTx, op *emdOp) (*domain.TenderEMDAuditLog, error)) (*emdOp, error) {
	bid, err := s.repo.GetByID(ctx, bidID)
	if err != nil {
		return nil, err
	}
	if emdNotRequired(bid) {
		return nil, emdInvalid("EMD is exempted or not applicable for this tender")
	}
	op := &emdOp{bid: bid, actorID: actorID, roles: roles, actorName: "System", now: time.Now()}
	if u, _ := s.repo.GetUserSummary(ctx, actorID); u != nil && u.FullName != "" {
		op.actorName = u.FullName
	}
	role := strings.Join(roles, ",")
	if len(role) > 50 {
		role = role[:50]
	}

	err = s.repo.WithEMDTx(ctx, bidID, func(tx domain.EMDTx) error {
		stored, err := tx.Lock(ctx, defaultEMD(bid))
		if err != nil {
			return err
		}
		op.emd = emdView(bid, stored)
		entry, err := apply(tx, op)
		if err != nil {
			return err
		}
		op.emd.UpdatedBy = &actorID
		if err := tx.Save(ctx, op.emd); err != nil {
			return err
		}
		entry.BidID, entry.EMDID = bidID, op.emd.ID
		entry.ActorID, entry.ActorName, entry.ActorRole = &actorID, &op.actorName, &role
		return tx.Log(ctx, entry)
	})
	if err != nil {
		return nil, err
	}
	return op, nil
}

// emdStageEvent records a best-effort entry in the tender's stage history.
func (s *bidService) emdStageEvent(ctx context.Context, op *emdOp, stage, eventType, reason string) {
	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID:            op.bid.ID,
		BidTitle:         op.bid.Title,
		ToStage:          stage,
		EventType:        &eventType,
		TransitionReason: &reason,
		TransitionedBy:   op.actorID,
	})
}

func (s *bidService) UpdateBasicEMD(ctx context.Context, bidID string, req *domain.UpdateBasicEMDRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	if !isFinanceOrAdmin(actorRoles) {
		return nil, emdForbidden("only Finance team or Administrators can modify EMD details")
	}
	op, err := s.mutateEMD(ctx, bidID, actorID, actorRoles, func(tx domain.EMDTx, op *emdOp) (*domain.TenderEMDAuditLog, error) {
		emd := op.emd
		if emd.Status == domain.EMDStatusPendingMDApproval {
			return nil, emdInvalid("EMD details cannot be changed while awaiting MD approval")
		}
		if req.DueDate != nil {
			t, err := parseDateFlexible(*req.DueDate)
			if err != nil {
				return nil, emdInvalid("due date: %v", err)
			}
			emd.DueDate = t
		}
		if req.ReferenceNumber != nil {
			emd.ReferenceNumber = req.ReferenceNumber
		}
		if req.Purpose != nil {
			emd.Purpose = req.Purpose
		}
		if req.Remarks != nil {
			emd.Remarks = req.Remarks
		}
		return &domain.TenderEMDAuditLog{Action: domain.EMDActionUpdated, Remarks: req.Remarks}, nil
	})
	if err != nil {
		return nil, err
	}
	return s.enrichEMDResponse(ctx, op.emd), nil
}

func (s *bidService) SubmitEMDForMDApproval(ctx context.Context, bidID string, req *domain.SubmitMDApprovalRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	if !isFinanceOrAdmin(actorRoles) {
		return nil, emdForbidden("only Finance team can submit EMD for MD approval")
	}
	remarks := ""
	if req != nil && req.Remarks != nil {
		remarks = *req.Remarks
	}
	op, err := s.mutateEMD(ctx, bidID, actorID, actorRoles, func(tx domain.EMDTx, op *emdOp) (*domain.TenderEMDAuditLog, error) {
		emd := op.emd
		if emd.Status != domain.EMDStatusPending && emd.Status != domain.EMDStatusRejected {
			return nil, emdInvalid("EMD in status %q cannot be submitted for MD approval", emd.Status)
		}
		if emd.EMDAmount <= 0 {
			return nil, emdInvalid("set the EMD amount on the tender before submitting for MD approval")
		}
		if emd.DueDate == nil {
			return nil, emdInvalid("EMD due date is required before submitting for MD approval")
		}
		if emd.ReferenceNumber == nil || strings.TrimSpace(*emd.ReferenceNumber) == "" {
			return nil, emdInvalid("EMD reference number is required before submitting for MD approval")
		}
		if emd.Purpose == nil || strings.TrimSpace(*emd.Purpose) == "" {
			return nil, emdInvalid("EMD purpose is required before submitting for MD approval")
		}

		emd.Status = domain.EMDStatusPendingMDApproval
		emd.MDSubmittedBy, emd.MDSubmittedAt = &actorID, &op.now
		// A re-submission starts a fresh decision.
		emd.MDDecidedBy, emd.MDDecidedAt, emd.MDDecisionRemarks = nil, nil, nil
		if remarks != "" {
			emd.Remarks = &remarks
		}
		return &domain.TenderEMDAuditLog{Action: domain.EMDActionSubmittedMDApproval, Remarks: &remarks}, nil
	})
	if err != nil {
		return nil, err
	}

	s.emdStageEvent(ctx, op, domain.StageEMDProcessing, "EMD_MD_APPROVAL",
		fmt.Sprintf("EMD submitted for MD Approval by %s (Amount: ₹%.2f)", op.actorName, op.emd.EMDAmount))
	for _, role := range []string{"SUPER_ADMIN", "ADMIN"} {
		_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			TargetRole: role,
			BidID:      &bidID,
			CreatedBy:  &actorID,
			Type:       "ACTION_REQUIRED",
			Link:       alertDomain.StageLink(bidID, domain.StageEMDProcessing),
			Title:      fmt.Sprintf("EMD Approval Required — %s", op.bid.Title),
			Message:    fmt.Sprintf("<p>EMD details of <strong>₹%.2f</strong> have been verified and submitted by %s for MD Approval.</p>", op.emd.EMDAmount, html.EscapeString(op.actorName)),
		})
	}
	return s.enrichEMDResponse(ctx, op.emd), nil
}

func (s *bidService) ApproveEMD(ctx context.Context, bidID string, req *domain.MDDecisionRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	return s.decideEMD(ctx, bidID, req, actorID, actorRoles, true)
}

func (s *bidService) RejectEMD(ctx context.Context, bidID string, req *domain.MDDecisionRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	return s.decideEMD(ctx, bidID, req, actorID, actorRoles, false)
}

// decideEMD records the MD's decision. The approver must be someone other
// than the user who submitted (maker-checker).
func (s *bidService) decideEMD(ctx context.Context, bidID string, req *domain.MDDecisionRequest, actorID string, actorRoles []string, approve bool) (*domain.TenderEMDResponse, error) {
	if !isAdminRole(actorRoles) {
		return nil, emdForbidden("only Managing Director (Admin/Super Admin) can approve or reject EMD")
	}
	remarks := ""
	if req != nil {
		remarks = strings.TrimSpace(req.Remarks)
	}
	if !approve && remarks == "" {
		return nil, emdInvalid("rejection reason is mandatory")
	}
	op, err := s.mutateEMD(ctx, bidID, actorID, actorRoles, func(tx domain.EMDTx, op *emdOp) (*domain.TenderEMDAuditLog, error) {
		emd := op.emd
		if emd.Status != domain.EMDStatusPendingMDApproval {
			return nil, emdInvalid("EMD is not awaiting MD approval (status: %s)", emd.Status)
		}
		if emd.MDSubmittedBy != nil && *emd.MDSubmittedBy == actorID && !hasAnyRole(actorRoles, "SUPER_ADMIN") {
			return nil, emdForbidden("the approver must be a different user from the one who submitted the EMD")
		}
		emd.MDDecidedBy, emd.MDDecidedAt = &actorID, &op.now
		emd.MDDecisionRemarks = nil
		if remarks != "" {
			emd.MDDecisionRemarks = &remarks
		}
		action := domain.EMDActionMDRejected
		emd.Status = domain.EMDStatusRejected
		if approve {
			action = domain.EMDActionMDApproved
			emd.Status = domain.EMDStatusMDApproved
		}
		return &domain.TenderEMDAuditLog{Action: action, Remarks: &remarks}, nil
	})
	if err != nil {
		return nil, err
	}

	alert := &alertDomain.Alert{
		TargetRole: "FINANCE",
		BidID:      &bidID,
		CreatedBy:  &actorID,
		Link:       alertDomain.StageLink(bidID, domain.StageEMDProcessing),
	}
	name, note := html.EscapeString(op.actorName), html.EscapeString(remarks)
	if approve {
		s.emdStageEvent(ctx, op, domain.StageEMDProcessing, "EMD_MD_APPROVED", fmt.Sprintf("EMD approved by MD (%s). Payment unlocked.", op.actorName))
		alert.Type = "EMD"
		alert.Title = fmt.Sprintf("EMD Approved by MD — %s", op.bid.Title)
		alert.Message = fmt.Sprintf("<p>EMD of <strong>₹%.2f</strong> was approved by %s. Finance can now proceed to execute payment and enter payment details.</p>", op.emd.EMDAmount, name)
	} else {
		s.emdStageEvent(ctx, op, domain.StageEMDProcessing, "EMD_MD_REJECTED", fmt.Sprintf("EMD rejected by MD (%s): %s", op.actorName, remarks))
		alert.Type = "ACTION_REQUIRED"
		alert.Title = fmt.Sprintf("EMD Rejected by MD — %s", op.bid.Title)
		alert.Message = fmt.Sprintf("<p>EMD was rejected by %s with remark: <em>%s</em>. Returned to Finance for correction.</p>", name, note)
	}
	_ = s.alertSvc.CreateAlert(ctx, alert)
	return s.enrichEMDResponse(ctx, op.emd), nil
}

func (s *bidService) RecordEMDPayment(ctx context.Context, bidID string, req *domain.RecordEMDPaymentRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	if !isFinanceOrAdmin(actorRoles) {
		return nil, emdForbidden("only Finance team can enter EMD payment details")
	}

	// Request-only validation first, so a bad payload never takes the row lock.
	if req.PaymentAmount <= 0 {
		return nil, emdInvalid("payment amount must be greater than zero")
	}
	payDate, err := parseDateFlexible(req.PaymentDate)
	if err != nil || payDate == nil {
		return nil, emdInvalid("payment date: a valid date is required")
	}
	if payDate.After(time.Now().Add(24 * time.Hour)) {
		return nil, emdInvalid("payment date cannot be future-dated")
	}

	var refNumber string
	var details any
	var receiptURL *string
	switch req.PaymentMode {
	case domain.PaymentModeOnline:
		d := req.OnlineDetails
		if d == nil {
			return nil, emdInvalid("online payment details are required")
		}
		if strings.TrimSpace(d.TransactionID) == "" {
			return nil, emdInvalid("transaction ID / UTR number is required for online payment")
		}
		if strings.TrimSpace(d.PaymentGateway) == "" {
			return nil, emdInvalid("payment gateway is required for online payment")
		}
		if strings.TrimSpace(d.TransactionDateTime) == "" {
			return nil, emdInvalid("transaction date and time is required for online payment")
		}
		refNumber, receiptURL = d.TransactionID, d.ReceiptURL
		d.PaymentAmount = req.PaymentAmount
		details = d
	case domain.PaymentModeCheque:
		d := req.ChequeDetails
		if d == nil {
			return nil, emdInvalid("cheque payment details are required")
		}
		if strings.TrimSpace(d.ChequeNumber) == "" {
			return nil, emdInvalid("cheque number is required")
		}
		if strings.TrimSpace(d.ChequeDate) == "" {
			return nil, emdInvalid("cheque date is required")
		}
		if strings.TrimSpace(d.BankName) == "" {
			return nil, emdInvalid("bank name is required for cheque payment")
		}
		if strings.TrimSpace(d.SubmissionDate) == "" {
			return nil, emdInvalid("cheque submission date is required")
		}
		if strings.TrimSpace(d.ChequeStatus) == "" {
			d.ChequeStatus = domain.ChequeStatusSubmitted
		}
		refNumber, receiptURL = d.ChequeNumber, d.ReceiptURL
		d.Amount = req.PaymentAmount
		details = d
	case domain.PaymentModeChallan:
		d := req.ChallanDetails
		if d == nil {
			return nil, emdInvalid("challan payment details are required")
		}
		if strings.TrimSpace(d.ChallanNumber) == "" {
			return nil, emdInvalid("challan number is required")
		}
		if strings.TrimSpace(d.ChallanDate) == "" {
			return nil, emdInvalid("challan date is required")
		}
		if strings.TrimSpace(d.BankName) == "" {
			return nil, emdInvalid("bank name is required for challan payment")
		}
		if strings.TrimSpace(d.ChallanType) == "" {
			return nil, emdInvalid("challan type/purpose is required")
		}
		if strings.TrimSpace(d.ChallanStatus) == "" {
			d.ChallanStatus = domain.ChallanStatusSubmitted
		}
		refNumber, receiptURL = d.ChallanNumber, d.ReceiptURL
		d.Amount = req.PaymentAmount
		details = d
	default:
		return nil, emdInvalid("invalid payment mode: %s", req.PaymentMode)
	}
	for _, u := range []*string{req.PaymentReceiptURL, receiptURL} {
		if err := validateReceiptURL(bidID, u); err != nil {
			return nil, err
		}
	}
	detailsJSON, err := json.Marshal(details)
	if err != nil {
		return nil, err
	}

	dep := req.Depositor
	if strings.TrimSpace(dep.Name) == "" {
		return nil, emdInvalid("depositor person name is required")
	}
	if strings.TrimSpace(dep.Department) == "" {
		return nil, emdInvalid("depositor department is required")
	}
	depDate, err := parseDateFlexible(dep.DepositDate)
	if err != nil || depDate == nil {
		return nil, emdInvalid("depositor deposit date: a valid date is required")
	}
	if req.PaymentReference != nil && strings.TrimSpace(*req.PaymentReference) != "" {
		refNumber = strings.TrimSpace(*req.PaymentReference)
	}

	op, err := s.mutateEMD(ctx, bidID, actorID, actorRoles, func(tx domain.EMDTx, op *emdOp) (*domain.TenderEMDAuditLog, error) {
		emd := op.emd
		switch emd.Status {
		case domain.EMDStatusApproved, domain.EMDStatusMDApproved, domain.EMDStatusVerificationRejected:
		case domain.EMDStatusPaid, domain.EMDStatusVerified:
			// Re-recording a corrected payment is an administrator action. A row
			// with no payment details is a tender confirmed ready through Mark EMD
			// Ready before the lifecycle existed: Finance may fill those in.
			if emd.PaymentAmount != nil && !isAdminRole(actorRoles) {
				return nil, emdForbidden("payment is already recorded; only an Administrator can correct it")
			}
		default:
			return nil, emdInvalid("payment can only be recorded after MD approval (status: %s)", emd.Status)
		}
		if emd.EMDAmount <= 0 {
			return nil, emdInvalid("set the EMD amount on the tender before recording payment")
		}
		if paise(req.PaymentAmount) != paise(emd.EMDAmount) {
			word := "less"
			if paise(req.PaymentAmount) > paise(emd.EMDAmount) {
				word = "greater"
			}
			return nil, emdInvalid("payment amount (₹%.2f) cannot be %s than required EMD amount (₹%.2f)", req.PaymentAmount, word, emd.EMDAmount)
		}

		paid := round2(req.PaymentAmount)
		emd.PaymentMode, emd.PaymentAmount, emd.PaymentDate = &req.PaymentMode, &paid, payDate
		emd.PaymentStatus, emd.PaymentReference = &req.PaymentStatus, &refNumber
		emd.PaymentDetails, emd.PaymentReceiptURL = detailsJSON, req.PaymentReceiptURL
		emd.PaymentEnteredBy, emd.PaymentEnteredAt = &actorID, &op.now
		emd.DepositorName, emd.DepositorEmployeeID, emd.DepositorDepartment = &dep.Name, dep.EmployeeID, &dep.Department
		emd.DepositorDesignation, emd.DepositorContact, emd.DepositorEmail = dep.Designation, dep.ContactNumber, dep.EmailID
		emd.DepositDate, emd.DepositorRemarks = depDate, dep.Remarks

		// A fresh payment needs a fresh verification.
		emd.VerificationStatus = domain.VerificationStatusPending
		emd.VerificationRemarks, emd.VerifiedBy, emd.VerifiedAt = nil, nil, nil
		emd.Status = domain.EMDStatusPaid
		if emd.RefundStatus == domain.RefundStatusNA {
			emd.RefundStatus = domain.RefundStatusPending
		}
		if err := tx.MarkBidEMDReady(ctx, op.now); err != nil {
			return nil, err
		}
		return &domain.TenderEMDAuditLog{
			Action:  domain.EMDActionPaymentRecorded,
			Remarks: strPtr(fmt.Sprintf("Payment of ₹%.2f recorded via %s (Ref: %s) by %s", paid, req.PaymentMode, refNumber, dep.Name)),
			Details: detailsJSON,
		}, nil
	})
	if err != nil {
		return nil, err
	}

	s.emdStageEvent(ctx, op, domain.StageEMDProcessing, "EMD_PAYMENT",
		fmt.Sprintf("EMD payment completed: ₹%.2f via %s by %s", op.emd.EMDAmount, req.PaymentMode, dep.Name))
	s.announceEMDReady(ctx, op)
	return s.enrichEMDResponse(ctx, op.emd), nil
}

// announceEMDReady is the record Mark-EMD-Ready leaves on the tender, written
// when payment recording is what made the EMD ready: the FINANCE stage event
// (who confirmed, override or not) and the requester's notification.
func (s *bidService) announceEMDReady(ctx context.Context, op *emdOp) {
	approvedBy, reason, byLine := "FINANCE", "Finance confirmed EMD is ready",
		fmt.Sprintf("confirmed <strong>ready</strong> by Finance (%s)", html.EscapeString(op.actorName))
	if !hasAnyRole(op.roles, "FINANCE") {
		approvedBy = "ADMIN_OVERRIDE"
		reason = fmt.Sprintf("EMD marked Ready by %s — Super Admin override (not confirmed by Finance)", op.actorName)
		byLine = fmt.Sprintf("confirmed <strong>ready</strong> via a Super Admin override by %s — not a Finance confirmation", html.EscapeString(op.actorName))
	}
	stage := domain.StageEMDProcessing
	details, _ := json.Marshal(map[string]string{"approvedBy": approvedBy})
	_ = s.repo.AddStageHistory(ctx, &domain.BidStageHistory{
		BidID: op.bid.ID, BidTitle: op.bid.Title, FromStage: &stage, ToStage: stage,
		EventType: strPtr("FINANCE"), TransitionReason: &reason, Details: details, TransitionedBy: op.actorID,
	})

	if op.bid.BidOwnerID != "" {
		_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			UserID:    &op.bid.BidOwnerID,
			BidID:     &op.bid.ID,
			CreatedBy: &op.actorID,
			Type:      "EMD",
			Link:      alertDomain.StageLink(op.bid.ID, stage),
			Title:     fmt.Sprintf("EMD Ready — %s", op.bid.Title),
			Message:   fmt.Sprintf("<p>EMD for tender <strong>%s</strong> has been %s.</p>", html.EscapeString(op.bid.Title), byLine),
		})
	}
}

func (s *bidService) VerifyEMDPayment(ctx context.Context, bidID string, req *domain.VerifyEMDPaymentRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	if !isFinanceOrAdmin(actorRoles) {
		return nil, emdForbidden("only Finance team can verify EMD payments")
	}
	if req.Status != domain.VerificationStatusVerified && req.Status != domain.VerificationStatusRejected {
		return nil, emdInvalid("verification status must be %s or %s", domain.VerificationStatusVerified, domain.VerificationStatusRejected)
	}
	op, err := s.mutateEMD(ctx, bidID, actorID, actorRoles, func(tx domain.EMDTx, op *emdOp) (*domain.TenderEMDAuditLog, error) {
		emd := op.emd
		if (emd.Status != domain.EMDStatusPaid && emd.Status != domain.EMDStatusVerified) || emd.PaymentAmount == nil || *emd.PaymentAmount <= 0 {
			return nil, emdInvalid("payment must be recorded before it can be verified (status: %s)", emd.Status)
		}
		emd.VerificationStatus, emd.VerificationRemarks = req.Status, req.Remarks
		emd.VerifiedBy, emd.VerifiedAt = &actorID, &op.now
		action := domain.EMDActionVerified
		emd.Status = domain.EMDStatusVerified
		if req.Status == domain.VerificationStatusRejected {
			action = domain.EMDActionVerificationRejected
			emd.Status = domain.EMDStatusVerificationRejected
			// A payment Finance rejected is not a ready EMD; re-recording it sets the flag again.
			if err := tx.ClearBidEMDReady(ctx); err != nil {
				return nil, err
			}
		}
		return &domain.TenderEMDAuditLog{Action: action, Remarks: req.Remarks}, nil
	})
	if err != nil {
		return nil, err
	}
	s.emdStageEvent(ctx, op, domain.StageEMDProcessing, "EMD_VERIFICATION",
		fmt.Sprintf("EMD payment verification status set to %s by %s", req.Status, op.actorName))
	return s.enrichEMDResponse(ctx, op.emd), nil
}

// UpdateEMDRefund tracks the release / refund. RefundAmount is the total
// refunded to date (not an instalment) and may never exceed what was paid.
func (s *bidService) UpdateEMDRefund(ctx context.Context, bidID string, req *domain.UpdateEMDRefundRequest, actorID string, actorRoles []string) (*domain.TenderEMDResponse, error) {
	if !isFinanceOrAdmin(actorRoles) {
		return nil, emdForbidden("only Finance team can update EMD release/refund information")
	}
	if !validRefundStatuses[req.RefundStatus] {
		return nil, emdInvalid("invalid refund status: %s", req.RefundStatus)
	}
	if req.RefundMode != nil && len(*req.RefundMode) > 50 {
		return nil, emdInvalid("refund mode is too long")
	}
	if req.RefundStatus == domain.RefundStatusRefunded {
		if req.ActualRefundDate == nil || strings.TrimSpace(*req.ActualRefundDate) == "" {
			return nil, emdInvalid("actual refund date is mandatory when refund status is Refunded")
		}
		if req.RefundMode != nil && strings.EqualFold(*req.RefundMode, "Online") &&
			(req.RefundTransactionID == nil || strings.TrimSpace(*req.RefundTransactionID) == "") &&
			(req.RefundReferenceNumber == nil || strings.TrimSpace(*req.RefundReferenceNumber) == "") {
			return nil, emdInvalid("transaction ID/UTR is mandatory for online refunds")
		}
	}
	var expected, actual *time.Time
	var err error
	if req.ExpectedRefundDate != nil {
		if expected, err = parseDateFlexible(*req.ExpectedRefundDate); err != nil {
			return nil, emdInvalid("expected refund date: %v", err)
		}
	}
	if req.ActualRefundDate != nil {
		if actual, err = parseDateFlexible(*req.ActualRefundDate); err != nil {
			return nil, emdInvalid("actual refund date: %v", err)
		}
	}
	if err := validateReceiptURL(bidID, req.RefundReceiptURL); err != nil {
		return nil, err
	}

	op, err := s.mutateEMD(ctx, bidID, actorID, actorRoles, func(tx domain.EMDTx, op *emdOp) (*domain.TenderEMDAuditLog, error) {
		emd := op.emd
		switch emd.Status {
		case domain.EMDStatusPaid, domain.EMDStatusVerified, domain.EMDStatusReleased:
		default:
			return nil, emdInvalid("refund can only be tracked once the EMD is paid (status: %s)", emd.Status)
		}
		paid := emd.EMDAmount
		if emd.PaymentAmount != nil {
			paid = *emd.PaymentAmount
		}
		if req.RefundAmount != nil {
			if paise(*req.RefundAmount) <= 0 {
				return nil, emdInvalid("refund amount must be greater than zero")
			}
			if paise(*req.RefundAmount) > paise(paid) {
				return nil, emdInvalid("refund amount (₹%.2f) cannot exceed the amount paid (₹%.2f)", *req.RefundAmount, paid)
			}
			refund := round2(*req.RefundAmount)
			emd.RefundAmount = &refund
		} else if req.RefundStatus == domain.RefundStatusRefunded && emd.RefundAmount == nil {
			emd.RefundAmount = &paid
		}

		emd.RefundStatus = req.RefundStatus
		if req.ExpectedRefundDate != nil {
			emd.ExpectedRefundDate = expected
		}
		if req.ActualRefundDate != nil {
			emd.ActualRefundDate = actual
		}
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
		emd.RefundUpdatedBy, emd.RefundUpdatedAt = &actorID, &op.now

		switch req.RefundStatus {
		case domain.RefundStatusRefunded:
			emd.Status = domain.EMDStatusRefunded
			if err := tx.MarkBidEMDReturned(ctx, op.now); err != nil {
				return nil, err
			}
		case domain.RefundStatusReleased:
			emd.Status = domain.EMDStatusReleased
		}
		return &domain.TenderEMDAuditLog{Action: domain.EMDActionRefundUpdated, Remarks: req.RefundRemarks}, nil
	})
	if err != nil {
		return nil, err
	}
	s.emdStageEvent(ctx, op, domain.StageAwardHandover, "EMD_REFUND",
		fmt.Sprintf("EMD refund status updated to %s by %s", req.RefundStatus, op.actorName))
	return s.enrichEMDResponse(ctx, op.emd), nil
}

func (s *bidService) enrichEMDResponse(ctx context.Context, emd *domain.TenderEMDDetails) *domain.TenderEMDResponse {
	resp := &domain.TenderEMDResponse{
		ID:                   emd.ID,
		BidID:                emd.BidID,
		EMDAmount:            emd.EMDAmount,
		DueDate:              emd.DueDate,
		ReferenceNumber:      emd.ReferenceNumber,
		Purpose:              emd.Purpose,
		Status:               emd.Status,
		Remarks:              emd.Remarks,
		PaymentMode:          emd.PaymentMode,
		PaymentAmount:        emd.PaymentAmount,
		PaymentDate:          emd.PaymentDate,
		PaymentStatus:        emd.PaymentStatus,
		PaymentReference:     emd.PaymentReference,
		PaymentDetails:       emd.PaymentDetails,
		PaymentReceiptURL:    emd.PaymentReceiptURL,
		PaymentEnteredAt:     emd.PaymentEnteredAt,
		DepositorName:        emd.DepositorName,
		DepositorEmployeeID:  emd.DepositorEmployeeID,
		DepositorDepartment:  emd.DepositorDepartment,
		DepositorDesignation: emd.DepositorDesignation,
		DepositorContact:     emd.DepositorContact,
		DepositorEmail:       emd.DepositorEmail,
		DepositDate:          emd.DepositDate,
		DepositorRemarks:     emd.DepositorRemarks,
		VerificationStatus:   emd.VerificationStatus,
		VerificationRemarks:  emd.VerificationRemarks,
		VerifiedAt:           emd.VerifiedAt,
		MDSubmittedAt:        emd.MDSubmittedAt,
		MDDecidedAt:          emd.MDDecidedAt,
		MDDecisionRemarks:    emd.MDDecisionRemarks,
		RefundStatus:         emd.RefundStatus,
		ExpectedRefundDate:   emd.ExpectedRefundDate,
		ActualRefundDate:     emd.ActualRefundDate,
		RefundAmount:         emd.RefundAmount,
		RefundReferenceNo:    emd.RefundReferenceNo,
		RefundTransactionID:  emd.RefundTransactionID,
		RefundMode:           emd.RefundMode,
		RefundRemarks:        emd.RefundRemarks,
		RefundReceiptURL:     emd.RefundReceiptURL,
		RefundUpdatedAt:      emd.RefundUpdatedAt,
		CreatedAt:            emd.CreatedAt,
		UpdatedAt:            emd.UpdatedAt,
		IsMDApproved:         emdIsApproved(emd.Status),
		IsPaid:               emdIsPaid(emd.Status),
	}

	// Only the three people the UI names, each looked up once.
	users := map[string]*domain.UserSummary{}
	lookup := func(id *string) *domain.UserSummary {
		if id == nil {
			return nil
		}
		if _, ok := users[*id]; !ok {
			users[*id], _ = s.repo.GetUserSummary(ctx, *id)
		}
		return users[*id]
	}
	resp.MDSubmittedBy = lookup(emd.MDSubmittedBy)
	resp.MDDecidedBy = lookup(emd.MDDecidedBy)
	resp.VerifiedBy = lookup(emd.VerifiedBy)
	return resp
}
