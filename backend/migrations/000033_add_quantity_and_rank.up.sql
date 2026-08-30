-- Migration 000033: record product quantity and our competitive rank.
--
-- quantity: every tender is for some number of licences/units, and the team
-- has been tracking it in the sheet with nowhere to put it in the app.
--
-- our_rank: the position GlobX placed on price (L1, L2, ... H1). Stage 9 has
-- always *asked* for this — the "GlobX Rank" input in the Financial Evaluation
-- workspace — and the detail page already tries to render bid.our_rank. But no
-- column ever existed, so the value only survived inside the narrative outcome
-- text and the display never appeared. This gives it a real home, which the
-- bulk import also needs for the tracker's "Price Ranking" column.
--
-- Both are nullable: plenty of tenders legitimately have neither.

ALTER TABLE bid.bid_workspaces
    ADD COLUMN IF NOT EXISTS quantity  INTEGER,
    ADD COLUMN IF NOT EXISTS our_rank  TEXT;

-- Ranks are looked up when reporting on near-misses (how often are we L2?).
CREATE INDEX IF NOT EXISTS idx_bid_workspaces_our_rank
    ON bid.bid_workspaces (UPPER(TRIM(our_rank)))
    WHERE our_rank IS NOT NULL AND TRIM(our_rank) <> '';
