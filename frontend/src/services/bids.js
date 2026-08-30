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
  in_bin = false,
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
  if (in_bin)         params.set('in_bin', 'true')

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

// ── Log a granular audit micro-event (pricing/OEM/checklist/alert changes) ──
// Persisted server-side so every user sees it, not just the browser that
// performed the action. Payload: { from_stage, to_stage, event_type, transition_reason, details }
export async function addBidMicroEvent(id, payload) {
  const res = await apiFetch(`${BASE}/bids/${id}/history`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get Global Audit History (Database-backed) ─────────────────────────────
export async function getGlobalAuditHistory(limit = 100) {
  const res = await apiFetch(`${BASE}/bids/audit-history?limit=${limit}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get Tender Owner Performance Matrix ─────────────────────────────────────
export async function getTenderPerformanceMatrix() {
  const res = await apiFetch(`${BASE}/bids/performance-matrix`)
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

// ── Archive / Soft Delete Bid ───────────────────────────────────────────────
export async function archiveBid(id) {
  const res = await apiFetch(`${BASE}/bids/${id}`, { method: 'DELETE' })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function softDeleteBid(id) {
  return archiveBid(id)
}

// ── Restore Bid ─────────────────────────────────────────────────────────────
export async function restoreBid(id) {
  const res = await apiFetch(`${BASE}/bids/${id}/restore`, { method: 'POST' })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Permanent Delete Bid ────────────────────────────────────────────────────
export async function permanentDeleteBid(id) {
  const res = await apiFetch(`${BASE}/bids/${id}/permanent`, { method: 'DELETE' })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Allowed stage transitions (mirrors backend state machine) */
export const STAGE_TRANSITIONS = {
  DISCOVERED:                     ['OEM_AUTHORIZATION_REQUEST', 'CANCELLED'],
  OEM_AUTHORIZATION_REQUEST:       ['PRICING_REQUEST', 'DOCUMENT_CHECKLIST_PREPARATION', 'CANCELLED'],
  PRICING_REQUEST:                ['DOCUMENT_CHECKLIST_PREPARATION', 'EMD_PROCESSING', 'CANCELLED'],
  DOCUMENT_CHECKLIST_PREPARATION: ['EMD_PROCESSING', 'INTERNAL_APPROVAL', 'CANCELLED'],
  EMD_PROCESSING:                 ['INTERNAL_APPROVAL', 'GEM_SUBMISSION', 'CANCELLED'],
  INTERNAL_APPROVAL:              ['GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'CANCELLED'],
  GEM_SUBMISSION:                 ['TECHNICAL_EVALUATION', 'CANCELLED'],
  TECHNICAL_EVALUATION:           ['FINANCIAL_EVALUATION', 'LOST', 'CANCELLED'],
  FINANCIAL_EVALUATION:          ['AWARD_HANDOVER', 'LOST', 'CANCELLED'],
  AWARD_HANDOVER:                 ['WON', 'LOST', 'CANCELLED'],
  WON:                            [],
  LOST:                           [],
  CANCELLED:                      [],
}

/** Stage display labels */
export const STAGE_LABELS = {
  DISCOVERED:                     '1. Search & ID',
  OEM_AUTHORIZATION_REQUEST:       '2. OEM Auth',
  PRICING_REQUEST:                '3. Pricing Request',
  DOCUMENT_CHECKLIST_PREPARATION: '4. Checklist Prep',
  EMD_PROCESSING:                 '5. EMD Processing',
  INTERNAL_APPROVAL:              '6. Internal Approval',
  GEM_SUBMISSION:                 '7. GeM Submission',
  TECHNICAL_EVALUATION:           '8. Tech Eval',
  FINANCIAL_EVALUATION:          '9. Financial Eval',
  AWARD_HANDOVER:                 '10. Award & Delivery',
  WON:                            'Won',
  LOST:                           'Lost',
  CANCELLED:                      'Cancelled',
  SUBMITTED:                      'Submitted',
}

/** Stage color map for badges */
export const STAGE_COLORS = {
  DISCOVERED:                     'bg-slate-100 text-slate-700 border-slate-200',
  OEM_AUTHORIZATION_REQUEST:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  PRICING_REQUEST:                'bg-violet-50 text-violet-700 border-violet-200',
  DOCUMENT_CHECKLIST_PREPARATION: 'bg-purple-50 text-purple-700 border-purple-200',
  EMD_PROCESSING:                 'bg-amber-50 text-amber-700 border-amber-200',
  INTERNAL_APPROVAL:              'bg-yellow-50 text-yellow-700 border-yellow-200',
  GEM_SUBMISSION:                 'bg-lime-50 text-lime-700 border-lime-200',
  TECHNICAL_EVALUATION:           'bg-teal-50 text-teal-700 border-teal-200',
  FINANCIAL_EVALUATION:          'bg-cyan-50 text-cyan-700 border-cyan-200',
  AWARD_HANDOVER:                 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WON:                            'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOST:                           'bg-orange-50 text-orange-700 border-orange-200',
  CANCELLED:                      'bg-slate-100 text-slate-600 border-slate-200',
  SUBMITTED:                      'bg-lime-50 text-lime-700 border-lime-200',
}

/**
 * One palette for tender status, used by the pills, the title dot, the card
 * accent line and the card tint so they can never disagree.
 *
 * Red is reserved for genuinely destructive states — a cancelled tender and the
 * bin. Everything else is a normal point in a tender's life and gets its own
 * non-alarming colour. Every lookup falls back to neutral, never to red: the
 * old per-component colour chains defaulted to red, so any status they did not
 * explicitly name (Closed, Under Tech Eval) rendered as if something had gone
 * wrong.
 */
const NEUTRAL = {
  pill:   'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800/40',
  dot:    'bg-slate-400',
  accent: 'bg-slate-400',
  tint:   'bg-slate-50/30 border-slate-200/50 dark:bg-slate-950/10 dark:border-slate-900/30',
}

export const STATUS_STYLES = {
  // Live work — green reads as "moving".
  ACTIVE: {
    pill:   'bg-emerald-100 text-emerald-800 border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/30',
    dot:    'bg-emerald-500',
    accent: 'bg-emerald-500',
    tint:   'bg-emerald-50/30 border-emerald-200/50 dark:bg-emerald-950/10 dark:border-emerald-900/30',
  },
  // Submitted, waiting on the buyer.
  SUBMITTED: {
    pill:   'bg-lime-100 text-lime-800 border-lime-200/50 dark:bg-lime-950/40 dark:text-lime-400 dark:border-lime-800/30',
    dot:    'bg-lime-500',
    accent: 'bg-lime-500',
    tint:   'bg-lime-50/30 border-lime-200/50 dark:bg-lime-950/10 dark:border-lime-900/30',
  },
  // Under evaluation — a normal waiting state, not a problem.
  TECHNICAL_EVALUATION: {
    pill:   'bg-teal-100 text-teal-800 border-teal-200/50 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/30',
    dot:    'bg-teal-500',
    accent: 'bg-teal-500',
    tint:   'bg-teal-50/30 border-teal-200/50 dark:bg-teal-950/10 dark:border-teal-900/30',
  },
  WON: {
    pill:   'bg-sky-100 text-sky-800 border-sky-200/50 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/30',
    dot:    'bg-sky-500',
    accent: 'bg-sky-500',
    tint:   'bg-sky-50/30 border-sky-200/50 dark:bg-sky-950/10 dark:border-sky-900/30',
  },
  // Bid and did not win. An outcome, not an error — amber, not red.
  LOST: {
    pill:   'bg-orange-100 text-orange-800 border-orange-200/50 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/30',
    dot:    'bg-orange-500',
    accent: 'bg-orange-500',
    tint:   'bg-orange-50/30 border-orange-200/50 dark:bg-orange-950/10 dark:border-orange-900/30',
  },
  // Assessed then dropped without bidding — deliberately quiet.
  CLOSED: {
    pill:   'bg-zinc-100 text-zinc-600 border-zinc-300/60 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-700/40',
    dot:    'bg-zinc-400',
    accent: 'bg-zinc-400',
    tint:   'bg-zinc-50/40 border-zinc-200/60 dark:bg-zinc-950/20 dark:border-zinc-800/40',
  },
  // Cancelled is the destructive one, so this is where red belongs.
  CANCELLED: {
    pill:   'bg-red-100 text-red-800 border-red-200/50 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/30',
    dot:    'bg-red-500',
    accent: 'bg-red-500',
    tint:   'bg-red-50/30 border-red-200/50 dark:bg-red-950/10 dark:border-red-900/30',
  },
  ARCHIVED: {
    pill:   'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-800/40',
    dot:    'bg-slate-400',
    accent: 'bg-slate-400',
    tint:   'bg-gray-50/30 border-gray-200/50 dark:bg-gray-950/10 dark:border-gray-900/30',
  },
}

/** Style bundle for a status, defaulting to neutral rather than red. */
export function statusStyle(status) {
  return STATUS_STYLES[status] ?? NEUTRAL
}

/** Legacy shape: pill classes keyed by status. */
export const STATUS_COLORS = Object.fromEntries(
  Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.pill])
)

/** All workflow stages in order for the stepper */
export const WORKFLOW_STAGES_ORDERED = [
  'DISCOVERED',
  'OEM_AUTHORIZATION_REQUEST',
  'PRICING_REQUEST',
  'DOCUMENT_CHECKLIST_PREPARATION',
  'EMD_PROCESSING',
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


// ── List every bid across all pages ─────────────────────────────────────────
// The API caps a page at 100, so any caller that needs the whole set (dashboard
// metrics, analytics totals) must page through rather than ask for one big page.
export async function listAllBids(filters = {}) {
  const PAGE_SIZE = 100

  // The list endpoint returns the rows in `data` and the paging counters in
  // `meta` — total_pages lives on meta, not on data.
  const pageRows = (res) => (Array.isArray(res.data) ? res.data : res.data?.bids || [])

  const first = await listBids({ ...filters, page: 1, limit: PAGE_SIZE })
  if (!first.ok) return first

  const all = [...pageRows(first)]
  const totalPages = first.meta?.total_pages || 1

  for (let page = 2; page <= totalPages; page++) {
    const next = await listBids({ ...filters, page, limit: PAGE_SIZE })
    if (!next.ok) break
    const rows = pageRows(next)
    if (rows.length === 0) break
    all.push(...rows)
  }

  return { ...first, data: all }
}

// ── Bulk Import (Super Admin only) ──────────────────────────────────────────
// Uploads a GBX tracker workbook. With dryRun the server parses and returns a
// preview without writing; otherwise it commits every row in one transaction.
// format: 'gbx' (the original GBX Tracker layout) or 'dashboard' (the Tender
// Dashboard layout - a different column set, its own L1-L4 competitor pricing,
// and no separate open/closed status column).
export async function bulkImportTenders(file, { dryRun = true, format = 'gbx' } = {}) {
  const form = new FormData()
  form.append('file', file)

  const res = await apiFetch(`${BASE}/bids/bulk-import?dry_run=${dryRun}&format=${format}`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}
