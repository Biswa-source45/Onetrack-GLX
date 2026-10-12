// Run: node --test frontend/src/lib/postBid.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { postBidStatus, validateContacts, cleanContacts, CONTACT_GROUPS } from './postBid.js'

const ok = { name: 'Asha Rao', org: 'SBI', phone: '+91 98765 43210', email: 'asha@sbi.co.in' }
const full = () => ({ contacts: Object.fromEntries(CONTACT_GROUPS.map((g) => [g.key, [ok]])), na: [] })

test('status walks NOT_SUBMITTED -> UNASSIGNED -> WAITING -> DONE', () => {
  assert.equal(postBidStatus(null), 'NOT_SUBMITTED')
  assert.equal(postBidStatus({}), 'NOT_SUBMITTED')
  assert.equal(postBidStatus({ submittedAt: 'x' }), 'UNASSIGNED')
  assert.equal(postBidStatus({ submittedAt: 'x', financeUserId: 'u1' }), 'WAITING')
  assert.equal(postBidStatus({ submittedAt: 'x', financeUserId: 'u1', doneAt: '' }), 'WAITING')
  assert.equal(postBidStatus({ submittedAt: 'x', financeUserId: 'u1', doneAt: 'y' }), 'DONE')
})

test('a fully filled form is ready', () => {
  assert.deepEqual(validateContacts(full()), {})
})

test('every group needs a contact or N/A', () => {
  assert.equal(Object.keys(validateContacts({})).length, 5)
  const v = full(); v.contacts.oem = []; v.na = ['oem']
  assert.deepEqual(validateContacts(v), {})
  v.na = []
  assert.deepEqual(Object.keys(validateContacts(v)), ['oem'])
})

test('blank rows are ignored, partial rows are rejected', () => {
  const v = full()
  v.contacts.payment = [{ name: '', org: '', phone: '', email: '' }, ok]
  assert.deepEqual(validateContacts(v), {})
  v.contacts.payment = [{ name: '', org: 'SBI', phone: '', email: '' }]
  assert.match(validateContacts(v).payment, /needs a name/)
  v.contacts.payment = [{ name: 'Asha', org: '', phone: '', email: '' }]
  assert.match(validateContacts(v).payment, /phone number or an email/)
})

test('phone and email formats', () => {
  const v = full()
  v.contacts.customer = [{ name: 'Ravi', phone: '123', email: '' }]
  assert.match(validateContacts(v).customer, /too short/)
  v.contacts.customer = [{ name: 'Ravi', phone: '', email: 'not-an-email' }]
  assert.match(validateContacts(v).customer, /not valid/)
  v.contacts.customer = [{ name: 'Ravi', phone: '', email: 'ravi@cust.in' }]
  assert.deepEqual(validateContacts(v), {})
})

test('cleanContacts trims, drops blank rows and empties N/A groups', () => {
  const out = cleanContacts({
    contacts: { payment: [{ name: ' Asha ', org: ' SBI ', phone: ' 98765 43210 ', email: '' }, { name: '', org: '', phone: '', email: '' }], oem: [ok] },
    na: ['oem', 'bogus'],
  })
  assert.deepEqual(out.contacts.payment, [{ name: 'Asha', org: 'SBI', phone: '98765 43210', email: '' }])
  assert.deepEqual(out.contacts.oem, [])
  assert.deepEqual(out.contacts.customer, [])
  assert.deepEqual(out.na, ['oem'])
})
