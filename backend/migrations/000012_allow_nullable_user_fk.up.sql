-- Migration 000012: Make user FK columns nullable so user deletion preserves audit records

-- Allow bid_workspaces.bid_owner_id to be NULL (deleted user = unowned bid)
ALTER TABLE bid.bid_workspaces
    ALTER COLUMN bid_owner_id DROP NOT NULL;

-- Allow bid_workspaces.created_by to be NULL
ALTER TABLE bid.bid_workspaces
    ALTER COLUMN created_by DROP NOT NULL;

-- Allow bid_stage_history.transitioned_by to be NULL (deleted actor = system/deleted)
ALTER TABLE bid.bid_stage_history
    ALTER COLUMN transitioned_by DROP NOT NULL;

-- Make bid members added_by nullable
ALTER TABLE bid.bid_workspace_members
    ALTER COLUMN added_by DROP NOT NULL;
