package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/onetrack/backend/internal/bid/domain"
)

const emdSelect = `
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
	WHERE bid_id = $1`

func scanEMD(row pgx.Row) (*domain.TenderEMDDetails, error) {
	emd := &domain.TenderEMDDetails{}
	err := row.Scan(
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
	return emd, err
}

// GetEMDDetails reads the lifecycle row without creating it; nil means the
// tender has none yet.
func (r *postgresBidRepo) GetEMDDetails(ctx context.Context, bidID string) (*domain.TenderEMDDetails, error) {
	emd, err := scanEMD(r.pool.QueryRow(ctx, emdSelect, bidID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query tender emd details: %w", err)
	}
	return emd, nil
}

func (r *postgresBidRepo) WithEMDTx(ctx context.Context, bidID string, fn func(tx domain.EMDTx) error) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin emd tx: %w", err)
	}
	defer tx.Rollback(ctx)
	if err := fn(&pgEMDTx{tx: tx, bidID: bidID}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// CloseOpenEMD retires rows that never reached payment, leaving an audit entry.
func (r *postgresBidRepo) CloseOpenEMD(ctx context.Context, bidID string) error {
	_, err := r.pool.Exec(ctx, `
		WITH closed AS (
			UPDATE bid.tender_emd_details SET status = $2, updated_at = NOW()
			WHERE bid_id = $1 AND status IN ('Pending', 'Pending MD Approval', 'Approved', 'MD Approved', 'Rejected')
			RETURNING id, bid_id
		)
		INSERT INTO bid.tender_emd_audit_logs (bid_id, emd_id, action, remarks)
		SELECT bid_id, id, $3, 'Tender marked EMD exempted / not applicable' FROM closed`,
		bidID, domain.EMDStatusNotApplicable, domain.EMDActionClosed)
	return err
}

type pgEMDTx struct {
	tx    pgx.Tx
	bidID string
}

func (t *pgEMDTx) Lock(ctx context.Context, def *domain.TenderEMDDetails) (*domain.TenderEMDDetails, error) {
	if _, err := t.tx.Exec(ctx, `
		INSERT INTO bid.tender_emd_details (
			bid_id, emd_amount, due_date, reference_number, purpose, status,
			payment_mode, refund_status, created_by, updated_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		ON CONFLICT (bid_id) DO NOTHING`,
		t.bidID, def.EMDAmount, def.DueDate, def.ReferenceNumber, def.Purpose, def.Status,
		def.PaymentMode, def.RefundStatus, def.CreatedBy,
	); err != nil {
		return nil, fmt.Errorf("init emd row: %w", err)
	}
	emd, err := scanEMD(t.tx.QueryRow(ctx, emdSelect+" FOR UPDATE", t.bidID))
	if err != nil {
		return nil, fmt.Errorf("lock emd row: %w", err)
	}
	return emd, nil
}

func (t *pgEMDTx) Save(ctx context.Context, emd *domain.TenderEMDDetails) error {
	args := []any{emd.ID}
	var sets []string
	set := func(col string, v any) {
		args = append(args, v)
		sets = append(sets, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	paymentDetails := emd.PaymentDetails
	if len(paymentDetails) == 0 {
		paymentDetails = []byte("{}")
	}

	set("emd_amount", emd.EMDAmount)
	set("due_date", emd.DueDate)
	set("reference_number", emd.ReferenceNumber)
	set("purpose", emd.Purpose)
	set("status", emd.Status)
	set("remarks", emd.Remarks)
	set("payment_mode", emd.PaymentMode)
	set("payment_amount", emd.PaymentAmount)
	set("payment_date", emd.PaymentDate)
	set("payment_status", emd.PaymentStatus)
	set("payment_reference", emd.PaymentReference)
	set("payment_details", paymentDetails)
	set("payment_receipt_url", emd.PaymentReceiptURL)
	set("payment_entered_by", emd.PaymentEnteredBy)
	set("payment_entered_at", emd.PaymentEnteredAt)
	set("depositor_name", emd.DepositorName)
	set("depositor_employee_id", emd.DepositorEmployeeID)
	set("depositor_department", emd.DepositorDepartment)
	set("depositor_designation", emd.DepositorDesignation)
	set("depositor_contact", emd.DepositorContact)
	set("depositor_email", emd.DepositorEmail)
	set("deposit_date", emd.DepositDate)
	set("depositor_remarks", emd.DepositorRemarks)
	set("verification_status", emd.VerificationStatus)
	set("verification_remarks", emd.VerificationRemarks)
	set("verified_by", emd.VerifiedBy)
	set("verified_at", emd.VerifiedAt)
	set("md_submitted_by", emd.MDSubmittedBy)
	set("md_submitted_at", emd.MDSubmittedAt)
	set("md_decided_by", emd.MDDecidedBy)
	set("md_decided_at", emd.MDDecidedAt)
	set("md_decision_remarks", emd.MDDecisionRemarks)
	set("refund_status", emd.RefundStatus)
	set("expected_refund_date", emd.ExpectedRefundDate)
	set("actual_refund_date", emd.ActualRefundDate)
	set("refund_amount", emd.RefundAmount)
	set("refund_reference_no", emd.RefundReferenceNo)
	set("refund_transaction_id", emd.RefundTransactionID)
	set("refund_mode", emd.RefundMode)
	set("refund_remarks", emd.RefundRemarks)
	set("refund_receipt_url", emd.RefundReceiptURL)
	set("refund_updated_by", emd.RefundUpdatedBy)
	set("refund_updated_at", emd.RefundUpdatedAt)
	set("updated_by", emd.UpdatedBy)

	err := t.tx.QueryRow(ctx,
		"UPDATE bid.tender_emd_details SET "+strings.Join(sets, ", ")+", updated_at = NOW() WHERE id = $1 RETURNING updated_at",
		args...).Scan(&emd.UpdatedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return fmt.Errorf("%w: this payment reference is already recorded against another EMD", domain.ErrValidation)
	}
	return err
}

func (t *pgEMDTx) Log(ctx context.Context, entry *domain.TenderEMDAuditLog) error {
	details := entry.Details
	if len(details) == 0 {
		details = json.RawMessage("{}")
	}
	return t.tx.QueryRow(ctx, `
		INSERT INTO bid.tender_emd_audit_logs (bid_id, emd_id, action, actor_id, actor_name, actor_role, remarks, details)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`,
		entry.BidID, entry.EMDID, entry.Action, entry.ActorID, entry.ActorName, entry.ActorRole, entry.Remarks, details,
	).Scan(&entry.ID, &entry.CreatedAt)
}

func (t *pgEMDTx) MarkBidEMDReady(ctx context.Context, at time.Time) error {
	_, err := t.tx.Exec(ctx, `UPDATE bid.bid_workspaces SET emd_ready = true, emd_ready_date = $2, updated_at = NOW() WHERE id = $1`, t.bidID, at)
	return err
}

func (t *pgEMDTx) MarkBidEMDReturned(ctx context.Context, at time.Time) error {
	_, err := t.tx.Exec(ctx, `UPDATE bid.bid_workspaces SET emd_returned = true, emd_returned_date = $2, updated_at = NOW() WHERE id = $1`, t.bidID, at)
	return err
}

// GetEMDAuditLogs fetches all EMD audit logs for a bid, newest first.
func (r *postgresBidRepo) GetEMDAuditLogs(ctx context.Context, bidID string) ([]domain.TenderEMDAuditLog, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, bid_id, emd_id, action, actor_id, actor_name, actor_role, remarks, details, created_at
		FROM bid.tender_emd_audit_logs
		WHERE bid_id = $1
		ORDER BY created_at DESC`, bidID)
	if err != nil {
		return nil, fmt.Errorf("query emd audit logs: %w", err)
	}
	defer rows.Close()

	logs := []domain.TenderEMDAuditLog{}
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
