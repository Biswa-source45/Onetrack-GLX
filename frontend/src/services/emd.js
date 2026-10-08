import { apiFetch } from './auth'

const BASE = '/api/v1'

// ── Status Configurations & Color Badges ─────────────────────────────────────
const SLATE = {
  color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800',
  dot: 'bg-slate-400',
}

export const EMD_STATUS_CONFIG = {
  'Pending': {
    label: 'Pending',
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    dot: 'bg-amber-500',
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
  'Verification Rejected': {
    label: 'Verification Rejected',
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  'Exempted': { label: 'Exempted', ...SLATE },
  'Not Applicable': { label: 'Not Applicable', ...SLATE },
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
  'Not Applicable': { color: 'bg-gray-100 text-gray-700 border-gray-200' },
  'Pending': { color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Initiated': { color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Released': { color: 'bg-teal-50 text-teal-700 border-teal-200' },
  'Refunded': { color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Failed': { color: 'bg-rose-50 text-rose-700 border-rose-200' },
}

export function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// ── API Functions ─────────────────────────────────────────────────────────────

// Every call resolves to { ok, status, data, message }; message is the server's
// error text when the call failed, so callers can toast it as-is.
async function call(path, init) {
  const res = await apiFetch(`${BASE}/bids/${path}`, init)
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data, message: data.error?.message || data.message }
}

const send = (bidId, path, method, body) => call(`${bidId}/emd${path}`, { method, body: JSON.stringify(body) })

export const getEmdDetails = (bidId) => call(`${bidId}/emd`)
export const updateBasicEmd = (bidId, payload) => send(bidId, '', 'PUT', payload)
export const submitEmdForMdApproval = (bidId, remarks = '') => send(bidId, '/submit-approval', 'POST', { remarks })
export const approveEmd = (bidId, remarks = '') => send(bidId, '/approve', 'POST', { remarks })
export const rejectEmd = (bidId, remarks) => send(bidId, '/reject', 'POST', { remarks })
export const recordEmdPayment = (bidId, payload) => send(bidId, '/payment', 'POST', payload)
export const verifyEmdPayment = (bidId, payload) => send(bidId, '/verify', 'POST', payload)
export const updateEmdRefund = (bidId, payload) => send(bidId, '/refund', 'POST', payload)
export const getEmdAuditLogs = (bidId) => call(`${bidId}/emd/audit-history`)

export function uploadEmdReceipt(bidId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return call(`${bidId}/emd/upload-receipt`, { method: 'POST', body: formData })
}

// A receipt is only ever linked if it is the exact shape the server issues —
// anything else (e.g. a javascript: URL) is ignored.
const RECEIPT_RE = /^\/api\/v1\/bids\/([0-9a-fA-F-]{36})\/emd\/receipt\/[0-9a-f]{32}\.(jpg|png|webp|pdf)$/
export function safeReceiptUrl(bidId, url) {
  const m = RECEIPT_RE.exec(url || '')
  return m && m[1] === bidId ? url : ''
}

// Receipts need the Bearer header, so they are fetched and handed to the
// browser as a blob.
export async function fetchReceiptBlob(url) {
  const res = await apiFetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

// Opens a receipt in a new tab. The tab is opened synchronously so the
// browser doesn't treat it as a blocked pop-up.
export async function openReceipt(url) {
  const tab = window.open('', '_blank')
  try {
    tab.location.href = URL.createObjectURL(await fetchReceiptBlob(url))
  } catch (err) {
    tab?.close()
    throw err
  }
}
