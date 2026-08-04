-- Migration 000016: Add stage_reviews JSONB column for per-stage review/re-verification flags
-- This column tracks which stages are flagged for re-verification, separately from completion state.

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS stage_reviews JSONB NOT NULL DEFAULT '{}'::jsonb;
