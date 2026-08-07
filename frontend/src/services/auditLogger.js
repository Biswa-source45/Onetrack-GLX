import { tokenStorage } from './auth'

/**
 * Log a granular micro-event into the audit history for a bid.
 * Stored in localStorage for instant offline/client auditability and synchronized with StageHistoryTab.
 */
export function logStageMicroEvent(bidId, {
  fromStage = null,
  toStage = 'MICRO_EVENT',
  eventType = 'GENERAL', // 'STAGE_CHANGE' | 'PRICING' | 'CHECKLIST' | 'ALERT' | 'OUTCOME' | 'OEM'
  transitionReason = '',
  details = null
}) {
  if (!bidId) return
  try {
    const key = `onetrack_checklist_history_${bidId}`
    const currentHist = JSON.parse(localStorage.getItem(key) || '[]')
    const currentUser = tokenStorage.getUser()

    const newEvent = {
      id: `micro_event_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      bid_id: bidId,
      from_stage: fromStage,
      to_stage: toStage,
      event_type: eventType,
      transition_reason: transitionReason,
      details: details,
      transitioned_by: {
        id: currentUser?.id,
        username: currentUser?.username || 'unknown',
        full_name: currentUser?.full_name || currentUser?.username || 'Super Admin'
      },
      created_at: new Date().toISOString()
    }

    localStorage.setItem(key, JSON.stringify([newEvent, ...currentHist]))
    // Notify history subscribers across the app
    window.dispatchEvent(new CustomEvent('onetrack_history_updated', { detail: { bidId } }))
  } catch (err) {
    console.error('Failed to log stage micro event', err)
  }
}
