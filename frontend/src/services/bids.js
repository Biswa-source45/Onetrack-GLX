import { apiFetch } from './auth'

const BASE = '/api/v1'

// ── Create Bid ───────────────────────────────────────────────────────────────
export async function createBid(payload) {
  const res = await apiFetch(`${BASE}/bids`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── List Bids (paginated + filtered) ────────────────────────────────────────
export async function listBids({
  page = 1,
  limit = 20,
  search = '',
  workflow_stage = '',
  bid_status = '',
  bid_outcome = '',
  bid_owner_id = '',
  category = '',
  creation_mode = '',
  closing_before = '',
  closing_after = '',
  oem_required = '',
} = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (search)         params.set('search', search)
  if (workflow_stage) params.set('workflow_stage', workflow_stage)
  if (bid_status)     params.set('bid_status', bid_status)
  if (bid_outcome)    params.set('bid_outcome', bid_outcome)
  if (bid_owner_id)   params.set('bid_owner_id', bid_owner_id)
  if (category)       params.set('category', category)
  if (creation_mode)  params.set('creation_mode', creation_mode)
  if (closing_before) params.set('closing_before', closing_before)
  if (closing_after)  params.set('closing_after', closing_after)
  if (oem_required !== '') params.set('oem_required', String(oem_required))

  const res = await apiFetch(`${BASE}/bids?${params.toString()}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get Single Bid ───────────────────────────────────────────────────────────
export async function getBid(id) {
  const res = await apiFetch(`${BASE}/bids/${id}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Update Bid (partial PATCH) ───────────────────────────────────────────────
export async function updateBid(id, payload) {
  const res = await apiFetch(`${BASE}/bids/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Transition Stage ─────────────────────────────────────────────────────────
export async function transitionBidStage(id, target_stage, reason = '') {
  const res = await apiFetch(`${BASE}/bids/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify({ target_stage, reason }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get Stage History ────────────────────────────────────────────────────────
export async function getBidStageHistory(id) {
  const res = await apiFetch(`${BASE}/bids/${id}/stage-history`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Add Member ───────────────────────────────────────────────────────────────
export async function addBidMember(bidId, user_id, role = 'MEMBER') {
  const res = await apiFetch(`${BASE}/bids/${bidId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id, role }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Remove Member ────────────────────────────────────────────────────────────
export async function removeBidMember(bidId, userId) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/members/${userId}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Record Outcome ───────────────────────────────────────────────────────────
export async function recordBidOutcome(id, payload) {
  const res = await apiFetch(`${BASE}/bids/${id}/outcome`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Archive Bid ──────────────────────────────────────────────────────────────
export async function archiveBid(id) {
  const res = await apiFetch(`${BASE}/bids/${id}`, { method: 'DELETE' })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Allowed stage transitions (mirrors backend state machine) */
export const STAGE_TRANSITIONS = {
  DISCOVERED:             ['QUALIFICATION_REVIEW', 'CANCELLED'],
  QUALIFICATION_REVIEW:   ['DOCUMENT_COMPILATION', 'CANCELLED'],
  DOCUMENT_COMPILATION:   ['OEM_COORDINATION', 'COMMERCIAL_PREPARATION'],
  OEM_COORDINATION:       ['COMMERCIAL_PREPARATION', 'CANCELLED'],
  COMMERCIAL_PREPARATION: ['INTERNAL_REVIEW'],
  INTERNAL_REVIEW:        ['FINAL_APPROVAL', 'COMMERCIAL_PREPARATION'],
  FINAL_APPROVAL:         ['READY_FOR_SUBMISSION', 'INTERNAL_REVIEW'],
  READY_FOR_SUBMISSION:   ['SUBMITTED'],
  SUBMITTED:              ['RA_ACTIVE', 'AWAITING_RESULT'],
  RA_ACTIVE:              ['AWAITING_RESULT'],
  AWAITING_RESULT:        ['WON', 'LOST', 'CANCELLED'],
  WON:                    [],
  LOST:                   [],
  CANCELLED:              [],
}

/** Stage display labels */
export const STAGE_LABELS = {
  DISCOVERED:             'Discovered',
  QUALIFICATION_REVIEW:   'Qualification Review',
  DOCUMENT_COMPILATION:   'Document Compilation',
  OEM_COORDINATION:       'OEM Coordination',
  COMMERCIAL_PREPARATION: 'Commercial Prep',
  INTERNAL_REVIEW:        'Internal Review',
  FINAL_APPROVAL:         'Final Approval',
  READY_FOR_SUBMISSION:   'Ready for Submission',
  SUBMITTED:              'Submitted',
  RA_ACTIVE:              'RA Active',
  AWAITING_RESULT:        'Awaiting Result',
  WON:                    'Won',
  LOST:                   'Lost',
  CANCELLED:              'Cancelled',
}

/** Stage color map for badges */
export const STAGE_COLORS = {
  DISCOVERED:             'bg-slate-100 text-slate-700 border-slate-200',
  QUALIFICATION_REVIEW:   'bg-blue-50 text-blue-700 border-blue-200',
  DOCUMENT_COMPILATION:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  OEM_COORDINATION:       'bg-violet-50 text-violet-700 border-violet-200',
  COMMERCIAL_PREPARATION: 'bg-amber-50 text-amber-700 border-amber-200',
  INTERNAL_REVIEW:        'bg-orange-50 text-orange-700 border-orange-200',
  FINAL_APPROVAL:         'bg-yellow-50 text-yellow-700 border-yellow-200',
  READY_FOR_SUBMISSION:   'bg-lime-50 text-lime-700 border-lime-200',
  SUBMITTED:              'bg-teal-50 text-teal-700 border-teal-200',
  RA_ACTIVE:              'bg-cyan-50 text-cyan-700 border-cyan-200',
  AWAITING_RESULT:        'bg-sky-50 text-sky-700 border-sky-200',
  WON:                    'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOST:                   'bg-red-50 text-red-700 border-red-200',
  CANCELLED:              'bg-gray-100 text-gray-500 border-gray-200',
}

export const STATUS_COLORS = {
  ACTIVE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED:'bg-red-50 text-red-700 border-red-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
  WON:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOST:     'bg-red-50 text-red-700 border-red-200',
}

/** All workflow stages in order for the stepper */
export const WORKFLOW_STAGES_ORDERED = [
  'DISCOVERED',
  'QUALIFICATION_REVIEW',
  'DOCUMENT_COMPILATION',
  'OEM_COORDINATION',
  'COMMERCIAL_PREPARATION',
  'INTERNAL_REVIEW',
  'FINAL_APPROVAL',
  'READY_FOR_SUBMISSION',
  'SUBMITTED',
  'RA_ACTIVE',
  'AWAITING_RESULT',
]

// ── Checklists ──────────────────────────────────────────────────────────────
export async function getChecklists(bidId) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/checklists`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function toggleChecklist(bidId, cid, isDone) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/checklists/${cid}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_done: isDone }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function addChecklist(bidId, title, sortOrder) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/checklists`, {
    method: 'POST',
    body: JSON.stringify({ title, sort_order: sortOrder }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function updateChecklist(bidId, cid, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/checklists/${cid}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function deleteChecklist(bidId, cid) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/checklists/${cid}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function reorderChecklists(bidId, items) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/checklists/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

