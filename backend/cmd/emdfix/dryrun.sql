-- emdfix dry run — READ ONLY. Changes nothing. Safe to run any time, as
-- many times as you want. Mirrors backend/cmd/emdfix/main.go exactly, so if
-- you ran the Go version locally, this prints the same lists on the host.
\pset pager off

\echo '=== 1. WILL BE MARKED emd_returned = true ==='
SELECT
  COALESCE(gem_bid_no, bid_no)      AS bid_id,
  organization_name,
  bid_status,
  emd_amount
FROM bid.bid_workspaces
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
ORDER BY organization_name;

\echo ''
\echo '=== 1b. Row count + total for the list above ==='
SELECT count(*) AS rows_to_fix, sum(emd_amount) AS total_amount
FROM bid.bid_workspaces
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
  );

\echo ''
\echo '=== 2. STAYING PENDING (authority-confirmed still outstanding — will NOT be touched) ==='
SELECT COALESCE(gem_bid_no, bid_no) AS bid_id, organization_name, bid_status, emd_amount
FROM bid.bid_workspaces
WHERE archived_at IS NULL AND metadata->>'imported' = 'true'
  AND (
    UPPER(TRIM(COALESCE(gem_bid_no,''))) IN (
      'GEM/2025/B/6935931','GEM/2026/B/7206177','GEM/2026/B/7139304',
      'GEM/2026/B/7268770','GEM/2026/B/7327401','GEM/2026/B/7360277',
      'GEM/2026/B/7392098','GEM/2026/B/7472152','GEM/2026/B/7791470'
    )
    OR UPPER(TRIM(COALESCE(bid_no,''))) IN (
      'GEM/2025/B/6935931','GEM/2026/B/7206177','GEM/2026/B/7139304',
      'GEM/2026/B/7268770','GEM/2026/B/7327401','GEM/2026/B/7360277',
      'GEM/2026/B/7392098','GEM/2026/B/7472152','GEM/2026/B/7791470'
    )
  )
ORDER BY organization_name;

\echo ''
\echo '=== 3. CANCELLED — reported only, will NOT be touched by apply.sql ==='
SELECT COALESCE(gem_bid_no, bid_no) AS bid_id, organization_name, emd_amount
FROM bid.bid_workspaces
WHERE archived_at IS NULL AND metadata->>'imported' = 'true'
  AND bid_status = 'CANCELLED' AND emd_exempted = false AND emd_not_applicable = false
ORDER BY organization_name;

\echo ''
\echo '=== 4. Bangalore Metro current emd_exempted flag (expect TRUE before applying) ==='
SELECT gem_bid_no, organization_name, emd_amount, emd_exempted
FROM bid.bid_workspaces
WHERE UPPER(TRIM(COALESCE(gem_bid_no,''))) = 'GEM/2025/B/6935931';

\echo ''
\echo '=== 5. Dashboard-equivalent EMD totals BEFORE applying (compare against these after) ==='
SELECT
  bid_status,
  count(*) AS tenders,
  sum(emd_amount) FILTER (WHERE emd_returned = false AND emd_exempted = false AND emd_not_applicable = false) AS outstanding,
  sum(emd_amount) FILTER (WHERE emd_returned = true) AS returned
FROM bid.bid_workspaces
WHERE archived_at IS NULL AND metadata->>'imported' = 'true'
GROUP BY bid_status
ORDER BY bid_status;
