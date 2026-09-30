-- EMD Processing has nothing to do on a tender with no EMD (exempted or not
-- applicable). Tenders parked there by the old stage-advance logic move on to
-- Internal Approval, matching what UpdateBid / TransitionStage now enforce.
UPDATE bid.bid_workspaces
SET workflow_stage = 'INTERNAL_APPROVAL', updated_at = NOW()
WHERE workflow_stage = 'EMD_PROCESSING'
  AND (emd_exempted OR emd_not_applicable);
