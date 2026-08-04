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
  DISCOVERED:                     ['ELIGIBILITY_ASSESSMENT', 'OEM_AUTHORIZATION_REQUEST', 'CANCELLED'],
  ELIGIBILITY_ASSESSMENT:         ['OEM_AUTHORIZATION_REQUEST', 'PRICING_REQUEST', 'CANCELLED'],
  OEM_AUTHORIZATION_REQUEST:       ['PRICING_REQUEST', 'DOCUMENT_CHECKLIST_PREPARATION', 'CANCELLED'],
  PRICING_REQUEST:                ['DOCUMENT_CHECKLIST_PREPARATION', 'EMD_PROCESSING', 'CANCELLED'],
  DOCUMENT_CHECKLIST_PREPARATION: ['EMD_PROCESSING', 'BID_DOCUMENTATION', 'CANCELLED'],
  EMD_PROCESSING:                 ['BID_DOCUMENTATION', 'INTERNAL_APPROVAL', 'CANCELLED'],
  BID_DOCUMENTATION:              ['INTERNAL_APPROVAL', 'GEM_SUBMISSION', 'CANCELLED'],
  INTERNAL_APPROVAL:              ['GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'CANCELLED'],
  GEM_SUBMISSION:                 ['TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION'],
  TECHNICAL_EVALUATION:           ['FINANCIAL_EVALUATION', 'LOST', 'CANCELLED'],
  FINANCIAL_EVALUATION:          ['AWARD_HANDOVER', 'LOST', 'CANCELLED'],
  AWARD_HANDOVER:                 [],
  WON:                            [],
  LOST:                           [],
  CANCELLED:                      [],
}

/** Stage display labels */
export const STAGE_LABELS = {
  DISCOVERED:                     '1. Search & ID',
  ELIGIBILITY_ASSESSMENT:         '2. Eligibility',
  OEM_AUTHORIZATION_REQUEST:       '3. OEM Auth',
  PRICING_REQUEST:                '4. Pricing Request',
  DOCUMENT_CHECKLIST_PREPARATION: '5. Checklist Prep',
  EMD_PROCESSING:                 '6. EMD Processing',
  BID_DOCUMENTATION:              '7. Documentation',
  INTERNAL_APPROVAL:              '8. Internal Approval',
  GEM_SUBMISSION:                 '9. GeM Submission',
  TECHNICAL_EVALUATION:           '10. Tech Eval',
  FINANCIAL_EVALUATION:          '11. Financial Eval',
  AWARD_HANDOVER:                 '12. Award & Delivery',
  WON:                            'Won',
  LOST:                           'Lost',
  CANCELLED:                      'Cancelled',
}

/** Stage color map for badges */
export const STAGE_COLORS = {
  DISCOVERED:                     'bg-slate-100 text-slate-700 border-slate-200',
  ELIGIBILITY_ASSESSMENT:         'bg-blue-50 text-blue-700 border-blue-200',
  OEM_AUTHORIZATION_REQUEST:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  PRICING_REQUEST:                'bg-violet-50 text-violet-700 border-violet-200',
  DOCUMENT_CHECKLIST_PREPARATION: 'bg-purple-50 text-purple-700 border-purple-200',
  EMD_PROCESSING:                 'bg-amber-50 text-amber-700 border-amber-200',
  BID_DOCUMENTATION:              'bg-orange-50 text-orange-700 border-orange-200',
  INTERNAL_APPROVAL:              'bg-yellow-50 text-yellow-700 border-yellow-200',
  GEM_SUBMISSION:                 'bg-lime-50 text-lime-700 border-lime-200',
  TECHNICAL_EVALUATION:           'bg-teal-50 text-teal-700 border-teal-200',
  FINANCIAL_EVALUATION:          'bg-cyan-50 text-cyan-700 border-cyan-200',
  AWARD_HANDOVER:                 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WON:                            'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOST:                           'bg-red-50 text-red-700 border-red-200',
  CANCELLED:                      'bg-gray-100 text-gray-500 border-gray-200',
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
  'ELIGIBILITY_ASSESSMENT',
  'OEM_AUTHORIZATION_REQUEST',
  'PRICING_REQUEST',
  'DOCUMENT_CHECKLIST_PREPARATION',
  'EMD_PROCESSING',
  'BID_DOCUMENTATION',
  'INTERNAL_APPROVAL',
  'GEM_SUBMISSION',
  'TECHNICAL_EVALUATION',
  'FINANCIAL_EVALUATION',
  'AWARD_HANDOVER',
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

