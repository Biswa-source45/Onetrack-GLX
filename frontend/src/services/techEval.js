import { apiFetch } from './auth'

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

export const TECH_EVAL_FIELDS = [
  { key: 'evaluation', label: 'Technical Evaluation Date' },
  { key: 'clarification', label: 'Technical Clarification Date' },
  { key: 'negotiation', label: 'Technical Negotiation Date' },
  { key: 'reverseAuction', label: 'Reverse Auction Date' },
]
