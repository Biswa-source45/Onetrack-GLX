-- Migration 000032: allow the CLOSED bid status.
--
-- bid_status has been constrained to ACTIVE / CANCELLED / ARCHIVED / WON / LOST
-- since 000004. None of those describes a tender that was assessed and then
-- dropped without ever being bid:
--   * CANCELLED implies the tender itself was withdrawn,
--   * LOST implies we bid and did not win.
--
-- The GBX tracker marks these "Closed", and they are the majority of the
-- historical sheet, so they need a status of their own rather than sitting in
-- the active pipeline forever.
--
-- CLOSED lives on bid_status only - there is no CLOSED workflow stage. A closed
-- tender keeps the stage it actually reached, so transitioning it forward
-- reopens it as ACTIVE through the existing UpdateStage path.

ALTER TABLE bid.bid_workspaces
    DROP CONSTRAINT IF EXISTS bid_workspaces_bid_status_check;

ALTER TABLE bid.bid_workspaces
    ADD CONSTRAINT bid_workspaces_bid_status_check
    CHECK (bid_status IN ('ACTIVE', 'CANCELLED', 'ARCHIVED', 'WON', 'LOST', 'CLOSED'));
