-- Migration 000031: enforce that a tender identifier belongs to one tender only.
--
-- A tender's GeM bid number (GEM/2026/B/1234567) or RFP number is its
-- real-world key. Two workspaces carrying the same one means the team is
-- tracking one tender twice, which corrupts every count and report built on
-- top of them.
--
-- Uniqueness is enforced in the service layer on create and update; these
-- indexes are the backstop that also catches concurrent writes.
--
-- Partial, so the constraint only covers live tenders:
--   * NULL identifiers are ignored by Postgres unique indexes anyway, which is
--     what we want - plenty of tenders have no GeM number.
--   * archived_at IS NULL excludes binned tenders, so deleting a tender frees
--     its identifier for re-use.
-- UPPER(TRIM(...)) so casing and stray whitespace cannot smuggle in a twin.

DO $$
DECLARE
    dup_count INTEGER;
    dup_list  TEXT;
BEGIN
    -- Report any pre-existing duplicates rather than failing the boot. The
    -- backend calls RunAutoMigrations with log.Fatalf, so a hard failure here
    -- would stop the server from starting on an environment that already has
    -- duplicate data.
    SELECT COUNT(*), STRING_AGG(ident, ', ')
      INTO dup_count, dup_list
      FROM (
        SELECT UPPER(TRIM(COALESCE(gem_bid_no, bid_no))) AS ident
          FROM bid.bid_workspaces
         WHERE archived_at IS NULL
           AND COALESCE(gem_bid_no, bid_no) IS NOT NULL
           AND TRIM(COALESCE(gem_bid_no, bid_no)) <> ''
         GROUP BY 1
        HAVING COUNT(*) > 1
      ) d;

    IF dup_count > 0 THEN
        RAISE WARNING 'Skipping unique tender identifier indexes: % duplicate identifier(s) already present (%). Resolve these, then re-run this migration.',
            dup_count, dup_list;
        RETURN;
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_workspaces_gem_bid_no_unique
        ON bid.bid_workspaces (UPPER(TRIM(gem_bid_no)))
        WHERE gem_bid_no IS NOT NULL
          AND TRIM(gem_bid_no) <> ''
          AND archived_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_workspaces_bid_no_unique
        ON bid.bid_workspaces (UPPER(TRIM(bid_no)))
        WHERE bid_no IS NOT NULL
          AND TRIM(bid_no) <> ''
          AND archived_at IS NULL;

    RAISE NOTICE 'Unique tender identifier indexes created.';
END $$;
