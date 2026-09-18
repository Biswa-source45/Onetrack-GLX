-- Migration 000044: Heal legacy tenders and ensure backwards compatibility for Primary Review
--
-- Automatically marks PRIMARY_REVIEW as completed for any tender already past DISCOVERED
-- or created without an Account Manager prior to this release, preventing in-flight
-- pipeline tenders on production from being locked out.
-- Also ensures requested_products and primary_review JSONB columns have safe default values.

-- 1. Ensure any tender past DISCOVERED has PRIMARY_REVIEW marked complete
UPDATE bid.bid_workspaces
SET stage_completions = COALESCE(stage_completions, '{}'::jsonb) || '{"PRIMARY_REVIEW": true}'::jsonb
WHERE workflow_stage <> 'DISCOVERED';

-- 2. For legacy tenders with no account manager assigned, ensure PRIMARY_REVIEW is marked complete
-- so they can proceed freely without requiring retroactive Account Manager assignment
UPDATE bid.bid_workspaces
SET stage_completions = COALESCE(stage_completions, '{}'::jsonb) || '{"PRIMARY_REVIEW": true}'::jsonb
WHERE account_manager_id IS NULL;

-- 3. Default NULL requested_products to empty array
UPDATE bid.bid_workspaces
SET requested_products = '[]'::jsonb
WHERE requested_products IS NULL;

-- 4. Default NULL primary_review to empty object
UPDATE bid.bid_workspaces
SET primary_review = '{}'::jsonb
WHERE primary_review IS NULL;
