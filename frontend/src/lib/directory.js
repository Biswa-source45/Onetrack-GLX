// My Accounts (Account Managers) and My OEMs (Pre-Sales): one private list per person, each record with
// contacts. One screen serves both, driven by this table. Rules mirror backend/internal/directory.
import { validateContact, findDuplicate } from './contacts.js'
import { isHttpUrl } from './tenderSpec.js'

export const KINDS = {
  accounts: {
    label: 'My Accounts', plural: 'accounts', one: 'account', Add: 'Add account', path: '/dashboard/accounts',
    blurb: 'The accounts you manage, with the people to talk to at each. Only you can see this list.',
    sectorLabel: 'Type / sector', sectorHint: 'e.g. IIT, IIM, Institution, PSU', hasWebsite: false,
  },
  oems: {
    label: 'My OEMs', plural: 'OEMs', one: 'OEM', Add: 'Add OEM', path: '/dashboard/oems',
    blurb: 'The OEMs you work with, with their contacts. Only you can see this list.',
    sectorLabel: 'Category', sectorHint: 'e.g. Servers, Networking, Software', hasWebsite: true,
  },
}

export const blankEntry = () => ({ name: '', sector: '', location: '', website: '', notes: '' })
export const blankContact = () => ({ name: '', designation: '', email: '', phone: '', remarks: '' })

const str = (v) => String(v ?? '').trim()

/** The record as it is sent: trimmed, only the fields the server stores. */
export const entryPayload = (e) => ({
  name: str(e.name), sector: str(e.sector), location: str(e.location), website: str(e.website), notes: str(e.notes),
})

export const contactPayload = (c) => ({
  name: str(c.name), designation: str(c.designation), email: str(c.email).toLowerCase(), phone: str(c.phone), remarks: str(c.remarks),
})

/** Message per field that cannot be saved (empty object = ready). */
export function validateEntry(e) {
  const v = entryPayload(e)
  const errors = {}
  if (!v.name) errors.name = 'Name is required'
  if (v.website && !isHttpUrl(v.website)) errors.website = 'Enter a link starting with http:// or https://'
  return errors
}

/** Contact rules are the Contacts tab's (name, email, phone), plus a duplicate check inside this record. */
export function validateDirectoryContact(c, all, selfId = '') {
  const errors = validateContact(c)
  const dup = findDuplicate(all, c, selfId)
  if (dup && !errors.email && !errors.phone) {
    errors[str(c.email) && str(c.email).toLowerCase() === String(dup.email).toLowerCase() ? 'email' : 'phone'] =
      `${dup.name} already has this`
  }
  return errors
}

/** Rows whose name, sector or location contains the search text (case-insensitive). */
export function filterEntries(entries, query) {
  const q = str(query).toLowerCase()
  if (!q) return entries
  return entries.filter((e) => [e.name, e.sector, e.location].some((f) => String(f ?? '').toLowerCase().includes(q)))
}
