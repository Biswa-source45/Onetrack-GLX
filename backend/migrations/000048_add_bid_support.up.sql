-- Migration 000048: Add support_type and support_partner_name to bid_workspaces
ALTER TABLE bid.bid_workspaces ADD COLUMN IF NOT EXISTS support_type VARCHAR(50) DEFAULT 'GLOBX';
ALTER TABLE bid.bid_workspaces ADD COLUMN IF NOT EXISTS support_partner_name VARCHAR(255);

