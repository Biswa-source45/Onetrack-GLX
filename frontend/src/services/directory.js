import { apiFetch } from './auth'

// kind is "accounts" or "oems" (see lib/directory.js). Every call answers { ok, status, data, error }.
const base = (kind) => `/api/v1/directory/${kind}`

async function call(url, method, body) {
  const res = await apiFetch(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}

export const listEntries = (kind) => call(base(kind), 'GET')
export const getEntry = (kind, id) => call(`${base(kind)}/${id}`, 'GET')
export const createEntry = (kind, payload) => call(base(kind), 'POST', payload)
export const updateEntry = (kind, id, payload) => call(`${base(kind)}/${id}`, 'PUT', payload)
export const deleteEntry = (kind, id) => call(`${base(kind)}/${id}`, 'DELETE')
export const addContact = (kind, id, payload) => call(`${base(kind)}/${id}/contacts`, 'POST', payload)
export const updateContact = (kind, id, cid, payload) => call(`${base(kind)}/${id}/contacts/${cid}`, 'PUT', payload)
export const deleteContact = (kind, id, cid) => call(`${base(kind)}/${id}/contacts/${cid}`, 'DELETE')
