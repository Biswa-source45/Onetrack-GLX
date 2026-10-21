import { apiFetch } from './auth'

const BASE = '/api/v1/users/credentials'

async function json(res) {
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...body }
}

// Super Admin only. Who would get which mail (no passwords in the answer).
export async function previewCredentialAlerts() {
  return json(await apiFetch(`${BASE}/preview`))
}

// { kinds: ['INITIAL'|'RESET_CONFIRM'], user_ids, include_alerted } -> 202 { batch_id, total }
export async function sendCredentialAlerts(payload) {
  return json(await apiFetch(`${BASE}/send`, { method: 'POST', body: JSON.stringify(payload) }))
}

export async function getCredentialBatch(id) {
  return json(await apiFetch(`${BASE}/batches/${id}`))
}

// Super Admin only. Sends an informational access-details email (no credentials) to
// all active users. siteUrl is the current office URL typed by the admin.
export async function sendAccessAlert(siteUrl) {
  return json(await apiFetch(`${BASE}/access-alert`, {
    method: 'POST',
    body: JSON.stringify({ site_url: siteUrl }),
  }))
}

