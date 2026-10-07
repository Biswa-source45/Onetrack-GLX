import { apiFetch } from './auth'

// ── System Logs ──────────────────────────────────────────────────────────────
// GET /api/v1/system-logs?limit=&cursor=&category=&user_id= — Super Admin only.
// Cursor-paginated newest-first, same shape as getGlobalAuditHistory.
export async function getSystemLogs({ limit = 30, cursor = '', category = '', userId = '' } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  if (category) params.set('category', category)
  if (userId) params.set('user_id', userId)
  const res = await apiFetch(`/api/v1/system-logs?${params.toString()}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}
