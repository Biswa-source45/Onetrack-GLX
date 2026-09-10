import { apiFetch } from './auth'

const BASE = '/api/v1/tickets'

// ── Submit feedback (any user) ──────────────────────────────────────────────
export async function createTicket({ category, custom_category, description }) {
  const res = await apiFetch(BASE, {
    method: 'POST',
    body: JSON.stringify({ category, custom_category, description }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── My Tickets (any user) — paginated, newest first ─────────────────────────
export async function listMyTickets({ limit = 30, cursor = '' } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  const res = await apiFetch(`${BASE}/mine?${params.toString()}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── All tickets (Super Admin) — paginated, filterable ───────────────────────
export async function listAllTickets({ limit = 30, cursor = '', status = '', category = '' } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  if (status) params.set('status', status)
  if (category) params.set('category', category)
  const res = await apiFetch(`${BASE}?${params.toString()}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── One ticket (owner or Super Admin) ────────────────────────────────────────
export async function getTicket(id) {
  const res = await apiFetch(`${BASE}/${id}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function getTicketHistory(id) {
  const res = await apiFetch(`${BASE}/${id}/history`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Change status (Super Admin) ──────────────────────────────────────────────
export async function updateTicketStatus(id, status, note) {
  const res = await apiFetch(`${BASE}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Open ticket count, for the sidebar badge (Super Admin) ──────────────────
export async function getOpenTicketCount() {
  const res = await apiFetch(`${BASE}/open-count`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}
