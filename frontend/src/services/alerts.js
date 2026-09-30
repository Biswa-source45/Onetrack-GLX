import { apiFetch } from './auth'

const BASE = '/api/v1'

export async function getAlerts() {
  const res = await apiFetch(`${BASE}/alerts`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function markAlertRead(id) {
  const res = await apiFetch(`${BASE}/alerts/${id}/read`, {
    method: 'PUT',
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function markAllAlertsRead() {
  const res = await apiFetch(`${BASE}/alerts/read-all`, {
    method: 'PUT',
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function deleteAlert(id) {
  const res = await apiFetch(`${BASE}/alerts/${id}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// Deep link to one stage of a tender — what an alert's `link` should be when
// it's about work in that stage, so clicking it (or the email button) lands
// on the stage instead of the tender's Overview. Mirrors the backend's
// alert domain StageLink.
export const stageLink = (bidId, stage) => `/dashboard/tenders/${bidId}?tab=stages&stage=${stage}`

/**
 * Create an in-app alert for a role or specific user.
 * @param {Object} payload - { target_role, user_id, bid_id, type, title, message, link }
 */
export async function createAlert(payload) {
  const res = await apiFetch(`${BASE}/alerts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}
