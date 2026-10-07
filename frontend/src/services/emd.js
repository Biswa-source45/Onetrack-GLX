import { apiFetch } from './auth'

const BASE = '/api/v1'

// ── Status Configurations & Color Badges ─────────────────────────────────────
export const EMD_STATUS_CONFIG = {
  'Pending': {
    label: 'Pending',
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  'Submitted': {
    label: 'Submitted',
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  'Under Verification': {
    label: 'Under Verification',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  'Pending MD Approval': {
    label: 'Pending MD Approval',
    color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800 animate-pulse',
    dot: 'bg-orange-500',
  },
  'Approved': {
    label: 'MD Approved',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  'MD Approved': {
    label: 'MD Approved',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  'Rejected': {
    label: 'Rejected',
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  'Paid': {
    label: 'Paid',
    color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800',
    dot: 'bg-teal-500',
  },
  'Verified': {
    label: 'Verified',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
    dot: 'bg-indigo-500',
  },
  'Released': {
    label: 'Released',
    color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
    dot: 'bg-sky-500',
  },
  'Refunded': {
    label: 'Refunded',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-600',
  },
}

export const REFUND_STATUS_CONFIG = {
  'Not Applicable': { label: 'Not Applicable', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  'Pending': { label: 'Refund Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Initiated': { label: 'Refund Initiated', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Released': { label: 'Released', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  'Refunded': { label: 'Refunded', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Failed': { label: 'Failed', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function getEmdDetails(bidId) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function updateBasicEmd(bidId, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function submitEmdForMdApproval(bidId, remarks = '') {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd/submit-approval`, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function approveEmd(bidId, remarks = '') {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd/approve`, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function rejectEmd(bidId, remarks) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd/reject`, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function recordEmdPayment(bidId, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd/payment`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function verifyEmdPayment(bidId, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd/verify`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function updateEmdRefund(bidId, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd/refund`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function getEmdAuditLogs(bidId) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/emd/audit-history`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

export async function uploadEmdReceipt(bidId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('onetrack_access_token') || ''
  const res = await fetch(`${BASE}/bids/${bidId}/emd/upload-receipt`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}
