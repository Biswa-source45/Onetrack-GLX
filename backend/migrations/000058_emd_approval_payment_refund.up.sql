-- Migration 000058: EMD Approval, Payment & Refund Lifecycle Tracking

CREATE TABLE IF NOT EXISTS bid.tender_emd_details (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id                         UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,

    -- A. Basic EMD Information
    emd_amount                     NUMERIC(15, 2) NOT NULL DEFAULT 0,
    due_date                       TIMESTAMPTZ,
    reference_number               TEXT,
    purpose                        TEXT,
    status                         VARCHAR(50) NOT NULL DEFAULT 'Pending',  -- CHECK added below
    remarks                        TEXT,

    -- B. Payment Details (Maintained after MD Approval)
    payment_mode                   VARCHAR(30),                             -- CHECK added below
    payment_amount                 NUMERIC(15, 2),
    payment_date                   TIMESTAMPTZ,
    payment_status                 VARCHAR(50),
    payment_reference              TEXT,        -- UTR / Cheque Number / Challan Number
    payment_details                JSONB NOT NULL DEFAULT '{}'::jsonb,
    payment_receipt_url            TEXT,
    payment_entered_by             UUID REFERENCES auth.users(id),
    payment_entered_at             TIMESTAMPTZ,

    -- C. Depositor / Person Details
    depositor_name                 TEXT,
    depositor_employee_id          TEXT,
    depositor_department           TEXT,
    depositor_designation          TEXT,
    depositor_contact              TEXT,
    depositor_email                TEXT,
    deposit_date                   TIMESTAMPTZ,
    depositor_remarks              TEXT,

    -- D. EMD Verification (Finance sign-off)
    verification_status            VARCHAR(50) NOT NULL DEFAULT 'Pending Verification'
                                   CHECK (verification_status IN ('Pending Verification', 'Verified', 'Rejected')),
    verification_remarks           TEXT,
    verified_by                    UUID REFERENCES auth.users(id),
    verified_at                    TIMESTAMPTZ,

    -- E. MD Approval Gate
    md_submitted_by                UUID REFERENCES auth.users(id),
    md_submitted_at                TIMESTAMPTZ,
    md_decided_by                  UUID REFERENCES auth.users(id),
    md_decided_at                  TIMESTAMPTZ,
    md_decision_remarks            TEXT,

    -- F. Release / Refund Tracking
    refund_status                  VARCHAR(50) NOT NULL DEFAULT 'Not Applicable'
                                   CHECK (refund_status IN ('Not Applicable', 'Pending', 'Initiated', 'Released', 'Refunded', 'Failed')),
    expected_refund_date           TIMESTAMPTZ,
    actual_refund_date             TIMESTAMPTZ,
    refund_amount                  NUMERIC(15, 2),
    refund_reference_no            TEXT,
    refund_transaction_id          TEXT,
    refund_mode                    VARCHAR(50),
    refund_remarks                 TEXT,
    refund_receipt_url             TEXT,
    refund_updated_by              UUID REFERENCES auth.users(id),
    refund_updated_at              TIMESTAMPTZ,

    -- Audit Metadata
    created_by                     UUID REFERENCES auth.users(id),
    updated_by                     UUID REFERENCES auth.users(id),
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tender_emd_details_bid UNIQUE (bid_id)
);

-- The CHECKs and default live here (drop + add) so a database that already ran
-- an earlier draft of this migration converges on the same definition.
ALTER TABLE bid.tender_emd_details DROP CONSTRAINT IF EXISTS tender_emd_details_status_check;
ALTER TABLE bid.tender_emd_details ADD CONSTRAINT tender_emd_details_status_check CHECK (status IN (
    'Pending', 'Pending MD Approval', 'Approved', 'MD Approved', 'Rejected',
    'Paid', 'Verified', 'Verification Rejected', 'Released', 'Refunded',
    'Not Applicable'  -- closed: tender became exempted / not applicable before payment
));
ALTER TABLE bid.tender_emd_details DROP CONSTRAINT IF EXISTS tender_emd_details_payment_mode_check;
ALTER TABLE bid.tender_emd_details ADD CONSTRAINT tender_emd_details_payment_mode_check
    CHECK (payment_mode IN ('Online', 'Cheque', 'Challan'));
ALTER TABLE bid.tender_emd_details ALTER COLUMN refund_status SET DEFAULT 'Not Applicable';

-- bid_id is already indexed by uq_tender_emd_details_bid.
DROP INDEX IF EXISTS bid.idx_tender_emd_details_bid;
CREATE INDEX IF NOT EXISTS idx_tender_emd_details_status ON bid.tender_emd_details(status);
-- One UTR / cheque / challan number can back only one EMD payment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_emd_payment_reference
    ON bid.tender_emd_details(payment_reference)
    WHERE payment_reference IS NOT NULL AND payment_reference <> '';

-- Tenders whose EMD was already confirmed through Mark EMD Ready keep their
-- state: Paid (or Refunded). Exempted / not-applicable tenders get no row.
INSERT INTO bid.tender_emd_details (bid_id, emd_amount, status, refund_status, created_by, updated_by)
SELECT w.id, COALESCE(w.emd_amount, 0),
       CASE WHEN w.emd_returned THEN 'Refunded' ELSE 'Paid' END,
       CASE WHEN w.emd_returned THEN 'Refunded' ELSE 'Pending' END,
       w.created_by, w.created_by
FROM bid.bid_workspaces w
WHERE w.emd_ready AND NOT w.emd_exempted AND NOT w.emd_not_applicable
ON CONFLICT (bid_id) DO NOTHING;

-- Immutable audit trail for all EMD transactions
CREATE TABLE IF NOT EXISTS bid.tender_emd_audit_logs (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id                         UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    emd_id                         UUID NOT NULL REFERENCES bid.tender_emd_details(id) ON DELETE CASCADE,
    action                         VARCHAR(50) NOT NULL,
    actor_id                       UUID REFERENCES auth.users(id),
    actor_name                     TEXT,
    actor_role                     VARCHAR(50),
    remarks                        TEXT,
    details                        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_emd_audit_bid ON bid.tender_emd_audit_logs(bid_id, created_at DESC);
