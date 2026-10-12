// Document shortfall: during Technical Evaluation the customer can ask for missing
// documents within a deadline. Each ask is a "round" stored in the tender's
// `doc_shortfall` JSON (see migration 000062):
//   COLLECTING -> PENDING_APPROVAL -> APPROVED -> SUBMITTED   (sent to the customer)
// A round's `outcome` records what the re-evaluation decided (QUALIFIED,
// DISQUALIFIED, or SHORTFALL when the customer asked for more documents).

export const ROUND_STATUS_LABEL = {
  COLLECTING: 'Collecting documents',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved, ready to send',
  SUBMITTED: 'Sent to customer',
}

export const shortfallRounds = (ds) => (Array.isArray(ds?.rounds) ? ds.rounds : [])
/** The round still being worked on (anything not yet sent to the customer). */
export const openRound = (ds) => shortfallRounds(ds).find((r) => r.status !== 'SUBMITTED') || null
export const lastRound = (ds) => shortfallRounds(ds).at(-1) || null
/** The last round was sent and the customer has not re-evaluated yet. */
export const awaitingReeval = (ds) => {
  const r = lastRound(ds)
  return !!r && r.status === 'SUBMITTED' && !r.outcome
}

let seq = 0
const docId = () => `d${Date.now().toString(36)}${seq++}`

/** Error message per field (empty object = ready to raise). */
export function validateRaise({ deadline, docs = [] } = {}, now = Date.now()) {
  const errors = {}
  const t = new Date(deadline).getTime()
  if (!deadline || Number.isNaN(t)) errors.deadline = 'Choose the date and time the customer gave'
  else if (t <= now) errors.deadline = 'The deadline must be in the future'
  if (!docs.some((d) => String(d?.name ?? '').trim())) errors.docs = 'List at least one document the customer asked for'
  return errors
}

export const patchRound = (ds, n, patch) => ({ ...ds, rounds: shortfallRounds(ds).map((r) => (r.n === n ? { ...r, ...patch } : r)) })

/** The doc_shortfall after a new round is raised; an unanswered earlier round is closed as SHORTFALL. */
export function addRound(ds, { deadline, note, docs, by, byId }, now = new Date()) {
  const rounds = shortfallRounds(ds).map((r, i, all) => (i === all.length - 1 && !r.outcome ? { ...r, outcome: 'SHORTFALL' } : r))
  return {
    ...ds,
    rounds: [...rounds, {
      n: rounds.length + 1, status: 'COLLECTING', deadline: new Date(deadline).toISOString(), note: String(note ?? '').trim(),
      raisedAt: now.toISOString(), raisedBy: by, raisedById: byId, outcome: '',
      docs: docs.filter((d) => String(d.name ?? '').trim()).map((d) => ({ id: docId(), name: d.name.trim(), note: String(d.note ?? '').trim(), file: null })),
    }],
  }
}

export const newDoc = (name) => ({ id: docId(), name: name.trim(), note: '', file: null, extra: true })

/** {total, added} documents of a round. */
export const docCounts = (round) => {
  const docs = round?.docs || []
  return { total: docs.length, added: docs.filter((d) => d.file).length }
}
/** Every document must be attached before the round can go for approval. */
export const readyForApproval = (round) => {
  const { total, added } = docCounts(round)
  return total > 0 && total === added
}

/** Where a deadline stands: overdue, soon (within 2 days) or ok, with a short label. */
export function dueState(deadline, now = Date.now()) {
  const ms = new Date(deadline).getTime() - now
  if (Number.isNaN(ms)) return { state: 'ok', label: '' }
  const abs = Math.abs(ms)
  const days = Math.floor(abs / 86400000)
  const hours = Math.floor((abs % 86400000) / 3600000)
  const span = days > 0 ? `${days}d ${hours}h` : `${Math.max(hours, 1)}h`
  if (ms < 0) return { state: 'overdue', label: `${span} overdue` }
  return { state: ms <= 2 * 86400000 ? 'soon' : 'ok', label: `${span} left` }
}

/** Who can approve a round: the tender's Reporting Manager and Account Manager, else the Bid Owner. */
export function approverChoices(bid) {
  const out = []
  const add = (u, role) => { if (u?.id && !out.some((o) => o.id === u.id)) out.push({ id: u.id, name: u.full_name || u.username || role, role }) }
  add(bid?.reporting_manager, 'Reporting Manager')
  add(bid?.account_manager, 'Account Manager')
  if (!out.length) add(bid?.bid_owner, 'Bid Owner')
  return out
}

export const OUTCOME_LABEL = { QUALIFIED: 'Qualified', DISQUALIFIED: 'Disqualified, bid lost', SHORTFALL: 'Asked for more documents' }
