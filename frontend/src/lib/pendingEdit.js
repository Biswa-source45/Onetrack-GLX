// A pending edit stores the request the Bid Executive sent (ids and JSON strings),
// while the Edit Tender form reads the bid the way the API returns it (nested
// people objects, parsed JSON). Layering the first over the second without
// converting made the review form drop the proposed products and alert note
// (and show the live Account Manager instead of the requested one), and
// approving then saved exactly that blank form.

const JSON_FIELDS = ['requested_products', 'alert_note']

// bid field holding the person object -> the request field carrying their id
const PEOPLE = [
  ['bid_owner', 'bid_owner_id'],
  ['reporting_manager', 'reporting_manager_id'],
  ['account_manager', 'account_manager_id'],
  ['presales', 'presales_id'],
]

/**
 * Returns `bid` with the proposed `payload` applied, in the bid's own shape.
 * Inputs are not mutated. A missing payload returns the bid unchanged.
 */
export function overlayPendingPayload(bid, payload) {
  if (!payload || typeof payload !== 'object') return bid
  const merged = { ...bid, ...payload }

  for (const key of JSON_FIELDS) {
    if (typeof merged[key] !== 'string') continue
    try {
      merged[key] = JSON.parse(merged[key])
    } catch {
      merged[key] = null
    }
  }

  // The proposed id wins, including "" (unassign): drop the stale object so
  // readers of `bid.account_manager?.id || bid.account_manager_id` see it.
  for (const [obj, idKey] of PEOPLE) {
    if (idKey in payload) delete merged[obj]
  }
  return merged
}
