ALTER TABLE bid.bid_stage_history
    DROP COLUMN IF EXISTS event_type,
    DROP COLUMN IF EXISTS details;
