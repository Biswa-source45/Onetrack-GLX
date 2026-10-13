import { apiFetch } from './auth'

// Tender contacts, one request per change (no whole-list saves). The contacts themselves
// arrive with GET /bids/:id (bid.contacts); these only change them.
async function call(path, init) {
  const res = await apiFetch(`/api/v1/bids/${path}`, init)
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data, message: data.error?.message || data.message }
}
const send = (bidId, path, method, body) => call(`${bidId}/contacts${path}`, { method, body: JSON.stringify(body) })

export const addContact = (bidId, contact) => send(bidId, '', 'POST', contact)
export const updateContact = (bidId, id, patch) => send(bidId, `/${id}`, 'PATCH', patch)
export const deleteContact = (bidId, id) => call(`${bidId}/contacts/${id}`, { method: 'DELETE' })
/** items: [{ id, kind, sort_order }] for every contact whose place changed (a drag and drop). */
export const reorderContacts = (bidId, items) => send(bidId, '/order', 'PUT', { items })
