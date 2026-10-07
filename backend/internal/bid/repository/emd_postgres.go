package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/onetrack/backend/internal/bid/domain"
)

// GetEMDDetails fetches the EMD record for a bid workspace.
// If no record exists yet, it initializes one lazily from the tender workspace.
func (r *postgresBidRepo) GetEMDDetails(ctx context.Context, bidID string) (*domain.TenderEMDDetails, error) {
	query := `
		SELECT id, bid_id, emd_amount, due_date, reference_number, purpose, status, remarks,
		       payment_mode, payment_amount, payment_date, payment_status, payment_reference,
		       COALESCE(payment_details, '{}'::jsonb), payment_receipt_url, payment_entered_by, payment_entered_at,
		       depositor_name, depositor_employee_id, depositor_department, depositor_designation,
		       depositor_contact, depositor_email, deposit_date, depositor_remarks,
		       verification_status, verification_remarks, verified_by, verified_at,
		       md_submitted_by, md_submitted_at, md_decided_by, md_decided_at, md_decision_remarks,
		       refund_status, expected_refund_date, actual_refund_date, refund_amount,
		       refund_reference_no, refund_transaction_id, refund_mode, refund_remarks,
		       refund_receipt_url, refund_updated_by, refund_updated_at,
		       created_by, updated_by, created_at, updated_at
		FROM bid.tender_emd_details
		WHERE bid_id = $1
	`
	emd := &domain.TenderEMDDetails{}
	err := r.pool.QueryRow(ctx, query, bidID).Scan(
		&emd.ID, &emd.BidID, &emd.EMDAmount, &emd.DueDate, &emd.ReferenceNumber, &emd.Purpose, &emd.Status, &emd.Remarks,
		&emd.PaymentMode, &emd.PaymentAmount, &emd.PaymentDate, &emd.PaymentStatus, &emd.PaymentReference,
		&emd.PaymentDetails, &emd.PaymentReceiptURL, &emd.PaymentEnteredBy, &emd.PaymentEnteredAt,
		&emd.DepositorName, &emd.DepositorEmployeeID, &emd.DepositorDepartment, &emd.DepositorDesignation,
		&emd.DepositorContact, &emd.DepositorEmail, &emd.DepositDate, &emd.DepositorRemarks,
		&emd.VerificationStatus, &emd.VerificationRemarks, &emd.VerifiedBy, &emd.VerifiedAt,
		&emd.MDSubmittedBy, &emd.MDSubmittedAt, &emd.MDDecidedBy, &emd.MDDecidedAt, &emd.MDDecisionRemarks,
		&emd.RefundStatus, &emd.ExpectedRefundDate, &emd.ActualRefundDate, &emd.RefundAmount,
		&emd.RefundReferenceNo, &emd.RefundTransactionID, &emd.RefundMode, &emd.RefundRemarks,
		&emd.RefundReceiptURL, &emd.RefundUpdatedBy, &emd.RefundUpdatedAt,
		&emd.CreatedBy, &emd.UpdatedBy, &emd.CreatedAt, &emd.UpdatedAt,
	)

	if err == nil {
		return emd, nil
	}

	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("query tender emd details: %w", err)
	}

	// Record doesn't exist yet: initialize lazily from bid_workspaces
	bid, err := r.GetByID(ctx, bidID)
	if err != nil {
		return nil, fmt.Errorf("lookup tender for emd init: %w", err)
	}

	initialAmount := 0.0
	if bid.EMDAmount != nil {
		initialAmount = *bid.EMDAmount
	}

	initialRef := ""
	if bid.GemBidNo != nil && *bid.GemBidNo != "" {
		initialRef = *bid.GemBidNo
	} else if bid.BidNo != nil {
		initialRef = *bid.BidNo
	}

	initialPurpose := "Tender EMD for " + bid.Title

	initialStatus := domain.EMDStatusPending
	if bid.EMDReady {
		initialStatus = domain.EMDStatusPaid
	}

	initialPaymentMode := "Online"
	if bid.EMDType != nil && *bid.EMDType != "" {
		if *bid.EMDType == "DD" {
			initialPaymentMode = "Cheque"
		} else {
			initialPaymentMode = "Online"
		}
	}

	newEMD := &domain.TenderEMDDetails{
		BidID:               bidID,
		EMDAmount:           initialAmount,
		DueDate:             bid.ClosingDate,
		ReferenceNumber:     &initialRef,
		Purpose:             &initialPurpose,
		Status:              initialStatus,
		VerificationStatus:  domain.VerificationStatusPending,
		RefundStatus:        domain.RefundStatusPending,
		PaymentMode:         &initialPaymentMode,
		PaymentDetails:      []byte("{}"),
		CreatedBy:           &bid.CreatedBy,
		UpdatedBy:           &bid.CreatedBy,
	}

	if err := r.UpsertEMDDetails(ctx, newEMD); err != nil {
		return nil, fmt.Errorf("auto-initialize emd record: %w", err)
	}

	// Re-fetch to populate returned IDs and generated timestamps
	return r.GetEMDDetails(ctx, bidID)
}

// UpsertEMDDetails inserts or updates the 1-to-1 EMD details for a bid workspace.
func (r *postgresBidRepo) UpsertEMDDetails(ctx context.Context, emd *domain.TenderEMDDetails) error {
	paymentDetailsJSON := emd.PaymentDetails
	if len(paymentDetailsJSON) == 0 {
		paymentDetailsJSON = []byte("{}")
	}

	query := `
		INSERT INTO bid.tender_emd_details (
			bid_id, emd_amount, due_date, reference_number, purpose, status, remarks,
			payment_mode, payment_amount, payment_date, payment_status, payment_reference,
			payment_details, payment_receipt_url, payment_entered_by, payment_entered_at,
			depositor_name, depositor_employee_id, depositor_department, depositor_designation,
			depositor_contact, depositor_email, deposit_date, depositor_remarks,
			verification_status, verification_remarks, verified_by, verified_at,
			md_submitted_by, md_submitted_at, md_decided_by, md_decided_at, md_decision_remarks,
			refund_status, expected_refund_date, actual_refund_date, refund_amount,
			refund_reference_no, refund_transaction_id, refund_mode, refund_remarks,
			refund_receipt_url, refund_updated_by, refund_updated_at,
			created_by, updated_by, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11, $12,
			$13, $14, $15, $16,
			$17, $18, $19, $20,
			$21, $22, $23, $24,
			$25, $26, $27, $28,
			$29, $30, $31, $32, $33,
			$34, $35, $36, $37,
			$38, $39, $40, $41,
			$42, $43, $44,
			$45, $46, NOW()
		)
		ON CONFLICT (bid_id) DO UPDATE SET
			emd_amount = EXCLUDED.emd_amount,
			due_date = EXCLUDED.due_date,
			reference_number = EXCLUDED.reference_number,
			purpose = EXCLUDED.purpose,
			status = EXCLUDED.status,
			remarks = EXCLUDED.remarks,
			payment_mode = EXCLUDED.payment_mode,
			payment_amount = EXCLUDED.payment_amount,
			payment_date = EXCLUDED.payment_date,
			payment_status = EXCLUDED.payment_status,
			payment_reference = EXCLUDED.payment_reference,
			payment_details = EXCLUDED.payment_details,
			payment_receipt_url = EXCLUDED.payment_receipt_url,
			payment_entered_by = EXCLUDED.payment_entered_by,
			payment_entered_at = EXCLUDED.payment_entered_at,
			depositor_name = EXCLUDED.depositor_name,
			depositor_employee_id = EXCLUDED.depositor_employee_id,
			depositor_department = EXCLUDED.depositor_department,
			depositor_designation = EXCLUDED.depositor_designation,
			depositor_contact = EXCLUDED.depositor_contact,
			depositor_email = EXCLUDED.depositor_email,
			deposit_date = EXCLUDED.deposit_date,
			depositor_remarks = EXCLUDED.depositor_remarks,
			verification_status = EXCLUDED.verification_status,
			verification_remarks = EXCLUDED.verification_remarks,
			verified_by = EXCLUDED.verified_by,
			verified_at = EXCLUDED.verified_at,
			md_submitted_by = EXCLUDED.md_submitted_by,
			md_submitted_at = EXCLUDED.md_submitted_at,
			md_decided_by = EXCLUDED.md_decided_by,
			md_decided_at = EXCLUDED.md_decided_at,
			md_decision_remarks = EXCLUDED.md_decision_remarks,
			refund_status = EXCLUDED.refund_status,
			expected_refund_date = EXCLUDED.expected_refund_date,
			actual_refund_date = EXCLUDED.actual_refund_date,
			refund_amount = EXCLUDED.refund_amount,
			refund_reference_no = EXCLUDED.refund_reference_no,
			refund_transaction_id = EXCLUDED.refund_transaction_id,
			refund_mode = EXCLUDED.refund_mode,
			refund_remarks = EXCLUDED.refund_remarks,
			refund_receipt_url = EXCLUDED.refund_receipt_url,
			refund_updated_by = EXCLUDED.refund_updated_by,
			refund_updated_at = EXCLUDED.refund_updated_at,
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
		RETURNING id, created_at, updated_at
	`

	return r.pool.QueryRow(ctx, query,
		emd.BidID, emd.EMDAmount, emd.DueDate, emd.ReferenceNumber, emd.Purpose, emd.Status, emd.Remarks,
		emd.PaymentMode, emd.PaymentAmount, emd.PaymentDate, emd.PaymentStatus, emd.PaymentReference,
		paymentDetailsJSON, emd.PaymentReceiptURL, emd.PaymentEnteredBy, emd.PaymentEnteredAt,
		emd.DepositorName, emd.DepositorEmployeeID, emd.DepositorDepartment, emd.DepositorDesignation,
		emd.DepositorContact, emd.DepositorEmail, emd.DepositDate, emd.DepositorRemarks,
		emd.VerificationStatus, emd.VerificationRemarks, emd.VerifiedBy, emd.VerifiedAt,
		emd.MDSubmittedBy, emd.MDSubmittedAt, emd.MDDecidedBy, emd.MDDecidedAt, emd.MDDecisionRemarks,
		emd.RefundStatus, emd.ExpectedRefundDate, emd.ActualRefundDate, emd.RefundAmount,
		emd.RefundReferenceNo, emd.RefundTransactionID, emd.RefundMode, emd.RefundRemarks,
		emd.RefundReceiptURL, emd.RefundUpdatedBy, emd.RefundUpdatedAt,
		emd.CreatedBy, emd.UpdatedBy,
	).Scan(&emd.ID, &emd.CreatedAt, &emd.UpdatedAt)
}

// LogEMDAction writes an immutable audit log entry for EMD actions.
func (r *postgresBidRepo) LogEMDAction(ctx context.Context, log *domain.TenderEMDAuditLog) error {
	detailsJSON := log.Details
	if len(detailsJSON) == 0 {
		detailsJSON = json.RawMessage("{}")
	}

	query := `
		INSERT INTO bid.tender_emd_audit_logs (
			bid_id, emd_id, action, actor_id, actor_name, actor_role, remarks, details
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`

	return r.pool.QueryRow(ctx, query,
		log.BidID, log.EMDID, log.Action, log.ActorID, log.ActorName, log.ActorRole, log.Remarks, detailsJSON,
	).Scan(&log.ID, &log.CreatedAt)
}

// GetEMDAuditLogs fetches all EMD audit logs for a bid, newest first.
func (r *postgresBidRepo) GetEMDAuditLogs(ctx context.Context, bidID string) ([]domain.TenderEMDAuditLog, error) {
	query := `
		SELECT id, bid_id, emd_id, action, actor_id, actor_name, actor_role, remarks, details, created_at
		FROM bid.tender_emd_audit_logs
		WHERE bid_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, bidID)
	if err != nil {
		return nil, fmt.Errorf("query emd audit logs: %w", err)
	}
	defer rows.Close()

	var logs []domain.TenderEMDAuditLog
	for rows.Next() {
		var l domain.TenderEMDAuditLog
		if err := rows.Scan(
			&l.ID, &l.BidID, &l.EMDID, &l.Action, &l.ActorID, &l.ActorName, &l.ActorRole, &l.Remarks, &l.Details, &l.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan emd audit log: %w", err)
		}
		logs = append(logs, l)
	}

	return logs, rows.Err()
}
