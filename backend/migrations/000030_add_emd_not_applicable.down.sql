ALTER TABLE bid.bid_workspaces
    DROP CONSTRAINT IF EXISTS chk_emd_exempted_not_applicable_exclusive;

ALTER TABLE bid.bid_workspaces
    DROP COLUMN IF EXISTS emd_not_applicable;
