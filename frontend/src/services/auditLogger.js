import { addBidMicroEvent } from './bids'

/**
 * Log a granular micro-event into the audit history for a bid.
 * Persisted server-side (bid.bid_stage_history) so it's visible to every
 * user viewing this tender, not just the browser that performed the action.
 * Fire-and-forget from the caller's perspective — callers don't await this.
 */
export function logStageMicroEvent(bidId, {
  fromStage = null,
  toStage = 'MICRO_EVENT',
  eventType = 'GENERAL', // 'STAGE_CHANGE' | 'PRICING' | 'CHECKLIST' | 'ALERT' | 'OUTCOME' | 'OEM'
  transitionReason = '',
  details = null
}) {
  if (!bidId) return
  addBidMicroEvent(bidId, {
    from_stage: fromStage,
    to_stage: toStage,
    event_type: eventType,
    transition_reason: transitionReason,
    details,
  }).then((res) => {
    if (res.ok) {
      // Notify history subscribers across the app
      window.dispatchEvent(new CustomEvent('onetrack_history_updated', { detail: { bidId } }))
    } else {
      console.error('Failed to log stage micro event', res.error)
    }
  }).catch((err) => {
    console.error('Failed to log stage micro event', err)
  })
}
