// OEM helpers shared by Primary Review, OEM Authorization (Stage 3), the Checklist
// tab and the tender Overview. Pure functions only (no React).
import { oemRowIds } from './contacts.js'

// Pre-Sales' per-product OEM used to be one free-text string per product
// index; it's now an array of candidates. Old tenders still carry the
// string, so every read goes through here. A legacy single value is treated
// as "suggested" so it keeps winning over the static requested_products
// seed in resolveProductOem below — an old tender must not visibly change.
export function normalizeOemCandidates(stored) {
  if (Array.isArray(stored)) return stored.filter(c => c && c.oem)
  if (typeof stored === 'string' && stored.trim()) {
    return [{ oem: stored.trim(), remarks: '', suggested: true }]
  }
  return []
}

// Single source of truth for "which OEM applies to requested_products[index]".
// Priority: Account Manager's final pick > Pre-Sales' suggested candidate >
// Pre-Sales' first candidate > the static Add/Edit-Tender seed.
export function resolveProductOem(bid, index) {
  const pr = (bid?.primary_review && typeof bid.primary_review === 'object') ? bid.primary_review : {}
  const am = (pr.amOemSelections || {})[index]
  if (am) return am
  const cands = normalizeOemCandidates((pr.presalesProducts || {})[index])
  const pick = cands.find(c => c.suggested) || cands[0]
  if (pick?.oem) return pick.oem
  return (bid?.requested_products || [])[index]?.oem || ''
}

// Two spellings of one OEM ("Dell", " dell ", "DELL  Technologies" vs "Dell Technologies") compare equal.
export const oemKey = (name) => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

// The OEMs the Account Manager confirmed in Primary Review (unique, first spelling
// kept), or null when nothing was ever confirmed — old tenders predate the
// confirmation record, so null means "don't know", never "none".
export function confirmedOems(bid) {
  const pr = (bid?.primary_review && typeof bid.primary_review === 'object') ? bid.primary_review : {}
  if (!pr.amOemFinalizedAt) return null
  const seen = new Set()
  const out = []
  for (const v of Object.values(pr.amOemSelections || {})) {
    const name = String(v ?? '').trim().replace(/\s+/g, ' ')
    const k = oemKey(name)
    if (k && !seen.has(k)) { seen.add(k); out.push(name) }
  }
  return out
}

// How much real work a matrix row carries; 0 means it is exactly as it was created.
function progressOf(o, withContacts) {
  return [
    o.initiated && o.initiated !== 'NO',
    o.initiatedByName, withContacts?.has(o.id),
    o.maf === 'RECEIVED',
    Object.values(o.docStatus || {}).some((v) => v === 'RECEIVED'),
    o.compliance && o.compliance !== 'NA',
    o.followUp, (o.followUps || []).length > 0, o.remark,
  ].filter(Boolean).length
}

/**
 * Brings the OEM Authorization rows in line with what Primary Review confirmed.
 *  1. Duplicates (same oemKey) merge, keeping the row with the most progress.
 *  2. If `confirmed` is null (nothing recorded) that is all that happens, so an old tender never loses rows.
 *  3. Otherwise rows that are not confirmed AND untouched are dropped; unconfirmed rows with
 *     progress stay (the UI flags them), and manually added rows always stay.
 *  4. With `makeRow`, confirmed OEMs that have no row yet get one, unless the user dismissed them.
 * Unchanged rows keep their object identity, so callers can detect "nothing changed" by reference.
 */
export function reconcileOemRows(rows, confirmed, { makeRow, dismissed, withContacts } = {}) {
  const best = new Map()
  for (const r of rows || []) {
    const k = oemKey(r?.name)
    if (!k) continue
    if (!best.has(k) || progressOf(r, withContacts) > progressOf(best.get(k), withContacts)) best.set(k, r)
  }
  let out = (rows || []).filter((r) => best.get(oemKey(r?.name)) === r)
  if (confirmed === null || confirmed === undefined) return out

  const want = new Set(confirmed.map(oemKey))
  out = out.filter((r) => want.has(oemKey(r.name)) || r.origin === 'manual' || progressOf(r, withContacts) > 0)
  if (makeRow) {
    const have = new Set(out.map((r) => oemKey(r.name)))
    const skip = dismissed || new Set()
    out = [...out, ...confirmed.filter((n) => !have.has(oemKey(n)) && !skip.has(oemKey(n))).map((n) => makeRow(n))]
  }
  return out
}

// The tender's OEM rows as every reader should see them (display-time cleanup of
// rows saved before this rule existed; no writes).
export function readOemRows(bid) {
  const w = bid?.oem_workspace
  const raw = Array.isArray(w) ? w : (Array.isArray(w?.oems) ? w.oems : [])
  return reconcileOemRows(raw, confirmedOems(bid), { withContacts: oemRowIds(bid?.contacts) })
}
