-- Migration 000058 Down: Revert EMD Approval, Payment & Refund Lifecycle Tracking

DROP TABLE IF EXISTS bid.tender_emd_audit_logs;
DROP TABLE IF EXISTS bid.tender_emd_details;
