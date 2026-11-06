-- Migration 000072: Technical Evaluation is opened explicitly after Bid Submission.
--
-- One JSONB on the tender: {rev, openedAt, openedBy, openedById, legacy?,
--  dates: {evaluation, clarification, negotiation, reverseAuction} (YYYY-MM-DD),
--  log: [{id, at, by, byId, kind: OPEN|NOTE|DATE, text, field?, from?, to?, change?}]}.
-- `log` is both the notes thread and the date history. Written only by the
-- /bids/:id/tech-eval/* endpoints (author and time are set server-side).
ALTER TABLE bid.bid_workspaces ADD COLUMN IF NOT EXISTS tech_eval JSONB DEFAULT NULL;

-- Tenders already past Bid Submission keep working: they are marked as opened.
UPDATE bid.bid_workspaces
   SET tech_eval = jsonb_build_object(
         'rev', 1, 'openedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         'openedBy', 'System (existing tender)', 'legacy', true,
         'dates', '{}'::jsonb, 'log', '[]'::jsonb)
 WHERE tech_eval IS NULL
   AND (stage_completions->>'GEM_SUBMISSION' = 'true'
        OR workflow_stage IN ('TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER'));
