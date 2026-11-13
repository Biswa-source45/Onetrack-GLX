import { apiFetch } from './auth.js'

// Technical Evaluation: open it after Bid Submission, then its dates and notes. Each call returns
// the whole tech_eval document as `data`; the server sets author and time.
async function call(bidId, path, method, body) {
  const res = await apiFetch(`/api/v1/bids/${bidId}/tech-eval/${path}`, { method, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data, message: data.error?.message || data.message }
}

export const openTechEval = (bidId, { date, remark }) => call(bidId, 'open', 'POST', { date, remark })
/** date '' clears it; reason is required when a date already exists. */
export const setTechEvalDate = (bidId, { field, date, reason }) => call(bidId, 'dates', 'PUT', { field, date, reason })
export const addTechEvalNote = (bidId, text) => call(bidId, 'notes', 'POST', { text })
export const addTechEvalDailyRemark = (bidId, text) => call(bidId, 'daily-remark', 'POST', { text })

export async function getTechEvalFollowUpStatus(bidId) {
  const res = await apiFetch(`/api/v1/bids/${bidId}/tech-eval/follow-up-status`)
  const d = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...d, data: d.data }
}

export async function triggerTechEvalFollowUpReminder(bidId) {
  const res = await apiFetch(`/api/v1/bids/${bidId}/tech-eval/remind-follow-up`, { method: 'POST' })
  const d = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...d, message: d.error?.message || d.message }
}

export const TECH_EVAL_FIELDS = [
  { key: 'bidExtension', label: 'Bid Date Extension' },
  { key: 'evaluation', label: 'Technical Evaluation Date' },
  { key: 'clarification', label: 'Technical Clarification Date' },
  { key: 'negotiation', label: 'Technical Negotiation Date' },
  { key: 'reverseAuction', label: 'Reverse Auction Date' },
]

/** Returns active date fields that have a value set in dates map (plus any custom keys) */
export function getActiveTechEvalFields(dates = {}) {
  const activeStandard = TECH_EVAL_FIELDS.filter((f) => Boolean(dates[f.key]))
  const customKeys = Object.keys(dates).filter((k) => Boolean(dates[k]) && !TECH_EVAL_FIELDS.some((f) => f.key === k))
  return [...activeStandard, ...customKeys.map((k) => ({ key: k, label: k }))]
}

/** Returns available standard date fields that are not yet added to dates map */
export function getAvailableTechEvalFields(dates = {}) {
  return TECH_EVAL_FIELDS.filter((f) => !dates[f.key])
}
