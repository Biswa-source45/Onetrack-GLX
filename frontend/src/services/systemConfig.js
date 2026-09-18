import { apiFetch } from './auth'

// ── System Configurations ──────────────────────────────────────────────────
// Manages dynamic platform settings stored in auth.system_configurations.

export async function getSystemConfigs() {
  try {
    const res = await apiFetch('/api/v1/system/config')
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Network error fetching configs' } }
  }
}

export async function getSystemConfig(key) {
  try {
    const res = await apiFetch(`/api/v1/system/config/${encodeURIComponent(key)}`)
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Network error fetching config' } }
  }
}

export async function updateSystemConfig(key, value) {
  try {
    const res = await apiFetch(`/api/v1/system/config/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    })
    const data = await res.json()
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('onetrack_config_updated', { detail: { key, value } }))
    }
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Network error updating config' } }
  }
}
