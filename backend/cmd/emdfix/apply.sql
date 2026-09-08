-- emdfix apply — WRITES DATA. Run dryrun.sql first and read every line of it.
-- Take a backup before running this (see the runbook). Wrapped in a single
-- transaction with ON_ERROR_STOP: any failure aborts before COMMIT, so it's
-- all-or-nothing. RETURNING prints exactly what changed.
\set ON_ERROR_STOP on
\pset pager off

BEGIN;

\echo '=== Marking emd_returned = true (imported, closed/lost/won, not on the pending list) ==='
UPDATE bid.bid_workspaces
SET emd_returned = true
WHERE archived_at IS NULL
  AND metadata->>'imported' = 'true'
  AND bid_status IN ('CLOSED','LOST','WON')
  AND emd_exempted = false
  AND emd_not_applicable = false
  AND emd_returned = false
  AND UPPER(TRIM(COALESCE(gem_bid_no,''))) NOT IN (
    'GEM/2025/B/6935931','GEM/2026/B/7206177','GEM/2026/B/7139304',
    'GEM/2026/B/7268770','GEM/2026/B/7327401','GEM/2026/B/7360277',
    'GEM/2026/B/7392098','GEM/2026/B/7472152','GEM/2026/B/7791470'
  )
  AND UPPER(TRIM(COALESCE(bid_no,''))) NOT IN (
    'GEM/2025/B/6935931','GEM/2026/B/7206177','GEM/2026/B/7139304',
    'GEM/2026/B/7268770','GEM/2026/B/7327401','GEM/2026/B/7360277',
    'GEM/2026/B/7392098','GEM/2026/B/7472152','GEM/2026/B/7791470'
  )
RETURNING gem_bid_no, bid_no, organization_name, emd_amount;

\echo ''
\echo '=== Clearing the wrong emd_exempted flag on Bangalore Metro ==='
UPDATE bid.bid_workspaces
SET emd_exempted = false
WHERE archived_at IS NULL AND metadata->>'imported' = 'true'
  AND UPPER(TRIM(COALESCE(gem_bid_no,''))) = 'GEM/2025/B/6935931'
RETURNING gem_bid_no, organization_name, emd_exempted;

COMMIT;

\echo ''
\echo '=== APPLIED AND COMMITTED — re-run dryrun.sql section 5 to confirm the new totals ==='
