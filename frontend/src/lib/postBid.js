// Post-bid contacts: after the bid is submitted (Stage 8) a Finance Manager/Executive
// records who to reach for payment, OEM, accounts and the customer. Stored as the
// tender's `post_bid` JSON (see migration 000061).

export const CONTACT_GROUPS = [
  { key: 'payment', label: 'Payment / Refund contact', hint: 'Mainly the bank or bank agent', orgLabel: 'Bank / agent' },
  { key: 'oem', label: 'OEM contact', hint: 'Pre-Sales Manager and OEM contacts', orgLabel: 'OEM / company' },
  { key: 'accounts', label: 'Accounts contact', hint: 'Account Manager and accounts contact', orgLabel: 'Company / team' },
  { key: 'customer', label: 'Customer contact', hint: 'Who to reach at the customer', orgLabel: 'Customer organisation' },
  { key: 'customerFinance', label: 'Customer finance manager', hint: "The customer's finance manager", orgLabel: 'Customer organisation' },
]

export const blankContact = () => ({ name: '', org: '', phone: '', email: '' })

const isBlank = (c) => !['name', 'org', 'phone', 'email'].some((k) => String(c?.[k] ?? '').trim())
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Where the hand-off stands: NOT_SUBMITTED -> UNASSIGNED -> WAITING -> DONE. */
export function postBidStatus(pb) {
  if (!pb?.submittedAt) return 'NOT_SUBMITTED'
  if (!pb.financeUserId) return 'UNASSIGNED'
  return pb.doneAt ? 'DONE' : 'WAITING'
}

/** One error message per group that is not ready to be marked complete (empty object = ready). */
export function validateContacts({ contacts = {}, na = [] } = {}) {
  const errors = {}
  for (const { key } of CONTACT_GROUPS) {
    if (na.includes(key)) continue
    const rows = (contacts[key] || []).filter((c) => !isBlank(c))
    if (rows.length === 0) {
      errors[key] = 'Add at least one contact, or mark this group not applicable'
      continue
    }
    for (const c of rows) {
      if (!String(c.name ?? '').trim()) { errors[key] = 'Every contact needs a name'; break }
      const phone = String(c.phone ?? '').trim()
      const email = String(c.email ?? '').trim()
      if (!phone && !email) { errors[key] = `${c.name.trim()}: add a phone number or an email`; break }
      if (phone && phone.replace(/\D/g, '').length < 7) { errors[key] = `${c.name.trim()}: phone number looks too short`; break }
      if (email && !EMAIL.test(email)) { errors[key] = `${c.name.trim()}: email address is not valid`; break }
    }
  }
  return errors
}

/** Contacts as they are saved: blank rows dropped, values trimmed, N/A groups emptied. */
export function cleanContacts({ contacts = {}, na = [] } = {}) {
  const out = {}
  for (const { key } of CONTACT_GROUPS) {
    out[key] = na.includes(key)
      ? []
      : (contacts[key] || []).filter((c) => !isBlank(c)).map((c) => ({
          name: String(c.name ?? '').trim(), org: String(c.org ?? '').trim(),
          phone: String(c.phone ?? '').trim(), email: String(c.email ?? '').trim(),
        }))
  }
  return { contacts: out, na: na.filter((k) => CONTACT_GROUPS.some((g) => g.key === k)) }
}
