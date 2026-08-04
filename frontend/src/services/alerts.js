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

/**
 * Create an in-app alert for a role or specific user.
 * @param {Object} payload - { target_role, user_id, bid_id, type, title, message }
 */
export async function createAlert(payload) {
  const res = await apiFetch(`${BASE}/alerts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}
