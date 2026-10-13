// Tender contacts (Contacts tab). The server keeps one row per contact (migration 000063); these are the
// rules the screen shares with it, so a mistake is caught before the request and explained the same way.

export const KINDS = [
  { key: 'CUSTOMER', label: 'Customer', hint: 'Customer and accounts side' },
  { key: 'BIDDER', label: 'Bidder', hint: 'Our own team and partners' },
  { key: 'OEM', label: 'OEM', hint: 'OEM and authorization contacts' },
  { key: 'OTHER', label: 'Other', hint: 'Bank / payment agent, anyone else' },
]
export const kindLabel = (k) => KINDS.find((x) => x.key === k)?.label || k

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const digits = (s) => String(s ?? '').replace(/\D/g, '')
// Two phone numbers are the same person when their last 10 digits match (+91 prefix or not).
const phoneKey = (s) => digits(s).slice(-10)

export const blankContact = (kind = 'CUSTOMER') => ({ kind, name: '', org: '', designation: '', phone: '', email: '', notes: '' })

/** Trimmed copy as it is saved (the server lower-cases the email too). */
export const cleanContact = (c) => ({
  ...c,
  name: String(c.name ?? '').trim(), org: String(c.org ?? '').trim(), designation: String(c.designation ?? '').trim(),
  phone: String(c.phone ?? '').trim(), email: String(c.email ?? '').trim().toLowerCase(), notes: String(c.notes ?? '').trim(),
})

/** Message per field that is not acceptable (empty object = ready to save). */
export function validateContact(c) {
  const v = cleanContact(c)
  const errors = {}
  if (!v.name) errors.name = 'Name is required'
  if (v.email && !EMAIL.test(v.email)) errors.email = 'Email address is not valid'
  if (v.phone && digits(v.phone).length < 7) errors.phone = 'Phone number looks too short'
  return errors
}

/** Another contact on the tender with the same email or phone number, or undefined. */
export function findDuplicate(all, c, selfId = '') {
  const v = cleanContact(c)
  const phone = phoneKey(v.phone)
  return (all || []).find((o) => o.id !== selfId && ((v.email && String(o.email).toLowerCase() === v.email) || (phone && phoneKey(o.phone) === phone)))
}

/** The contacts of each kind, in the order they are shown. */
export function groupContacts(contacts) {
  const out = Object.fromEntries(KINDS.map((k) => [k.key, []]))
  for (const c of contacts || []) (out[c.kind] || out.OTHER).push(c)
  for (const list of Object.values(out)) list.sort((a, b) => a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at)))
  return out
}

/**
 * Drop `id` into column `kind`, before the contact `beforeId` (or at the end). Returns the new
 * { id, kind, sort_order } of every contact whose place changed (both columns renumbered 1..n),
 * or [] when nothing moves.
 */
export function planDrop(contacts, id, kind, beforeId = null) {
  const cols = groupContacts(contacts)
  const moving = (contacts || []).find((c) => c.id === id)
  if (!moving || !cols[kind] || beforeId === id) return []
  const next = Object.fromEntries(Object.entries(cols).map(([k, list]) => [k, list.filter((c) => c.id !== id)]))
  const at = beforeId ? next[kind].findIndex((c) => c.id === beforeId) : -1
  next[kind].splice(at < 0 ? next[kind].length : at, 0, { ...moving, kind })
  const items = []
  for (const k of new Set([moving.kind, kind])) {
    next[k].forEach((c, i) => {
      const prev = (contacts || []).find((x) => x.id === c.id)
      if (!prev || prev.kind !== k || prev.sort_order !== i + 1) items.push({ id: c.id, kind: k, sort_order: i + 1 })
    })
  }
  return items
}

/** The contacts after a drop plan is applied (shown at once, before the server answers). */
export const applyPlan = (contacts, items) => (contacts || []).map((c) => { const it = items.find((i) => i.id === c.id); return it ? { ...c, kind: it.kind, sort_order: it.sort_order } : c })

/** Contacts typed in OEM Authorization for one matrix row. */
export const oemRowContacts = (contacts, rowId) => (contacts || []).filter((c) => c.source === 'OEM_AUTH' && c.source_ref === rowId)

/** "John Doe (john@oem.com)" -> { name: 'John Doe', email: 'john@oem.com' }; text without an email is just the name. */
export function parseContactText(text) {
  const t = String(text ?? '').trim()
  const m = t.match(/[^\s@()<>,;]+@[^\s@()<>,;]+\.[^\s@()<>,;]+/)
  if (!m) return { name: t, email: '' }
  return { name: t.replace(m[0], '').replace(/[()<>,;]+/g, ' ').replace(/\s+/g, ' ').trim() || m[0], email: m[0] }
}

/** Ids of the OEM matrix rows that have at least one contact (such a row counts as worked on). */
export const oemRowIds = (contacts) => new Set((contacts || []).filter((c) => c.source === 'OEM_AUTH').map((c) => c.source_ref))

/** Where a contact came from, for its badge ('' for a contact added by hand). */
export const sourceLabel = (c) => (c.source === 'OEM_AUTH' ? `OEM Authorization${c.org ? ` · ${c.org}` : ''}` : '')

/** Changes whenever any contact is added, edited, moved or removed (cheap "did it change" check). */
export const contactsSignature = (contacts) => (contacts || []).map((c) => `${c.id}:${c.updated_at}:${c.kind}:${c.sort_order}`).join('|')
