import { apiFetch } from './auth'

const BASE = '/api/v1/leads'

async function json(res) {
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}

export async function listLeads() {
  return json(await apiFetch(BASE))
}

export async function getLead(id) {
  return json(await apiFetch(`${BASE}/${id}`))
}

export async function createLead(payload) {
  return json(await apiFetch(BASE, { method: 'POST', body: JSON.stringify(payload) }))
}

export async function updateLead(id, payload) {
  return json(await apiFetch(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }))
}

// Permanent: removes the lead, its documents and its history.
export async function deleteLead(id) {
  return json(await apiFetch(`${BASE}/${id}`, { method: 'DELETE' }))
}

// One approval-workflow step: { action, approver_id?, note? }. The lead's
// own allowed_actions says which actions the current user may send.
export async function transitionLead(id, payload) {
  return json(await apiFetch(`${BASE}/${id}/transition`, { method: 'POST', body: JSON.stringify(payload) }))
}

// One file per request — keeps each request small (nginx/server limits) and
// lets the UI show which file failed instead of failing the whole batch.
// category: '' for a bulk upload, the typed label ("RFP") for a categorised one.
export async function uploadLeadDocument(leadId, file, category = '') {
  const body = new FormData()
  body.set('file', file, file.name)
  if (category) body.set('category', category)
  return json(await apiFetch(`${BASE}/${leadId}/documents`, { method: 'POST', body }))
}

export async function deleteLeadDocument(leadId, docId) {
  return json(await apiFetch(`${BASE}/${leadId}/documents/${docId}`, { method: 'DELETE' }))
}

// Downloads go through apiFetch (it carries the bearer token), then hand the
// blob to the browser as a normal file save.
export async function downloadLeadDocument(leadId, doc) {
  const res = await apiFetch(`${BASE}/${leadId}/documents/${doc.id}`)
  if (!res.ok) return false
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = doc.original_name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
