import { apiFetch } from './auth'

const BASE = '/api/v1/preferences'

async function json(res) {
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}

// The signed-in user's own choices, e.g. { tenders_view: 'cards' }. A key the user
// never set is absent; the app falls back to its own default.
export async function getPreferences() {
  return json(await apiFetch(BASE))
}

// Saves some choices and answers with all of them.
export async function savePreferences(patch) {
  return json(await apiFetch(BASE, { method: 'PUT', body: JSON.stringify(patch) }))
}
