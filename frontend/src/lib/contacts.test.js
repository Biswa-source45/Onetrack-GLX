// Run: node --test frontend/src/lib/contacts.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseContactText, validateContact, findDuplicate, groupContacts, planDrop, applyPlan, oemRowContacts, sourceLabel, contactsSignature, cleanContact } from './contacts.js'

const c = (id, kind, order, extra = {}) => ({ id, kind, sort_order: order, name: id, email: '', phone: '', created_at: '2026-01-01', updated_at: '1', ...extra })
const base = () => [c('a', 'OEM', 1), c('b', 'OEM', 2), c('c', 'OEM', 3), c('x', 'CUSTOMER', 1), c('y', 'CUSTOMER', 2)]
const ids = (list) => list.map((i) => i.id).join('')

test('validateContact: name, email and phone', () => {
  assert.deepEqual(validateContact({ name: 'Asha' }), {})
  assert.equal(validateContact({ name: '  ' }).name, 'Name is required')
  assert.match(validateContact({ name: 'A', email: 'nope' }).email, /not valid/)
  assert.match(validateContact({ name: 'A', phone: '12345' }).phone, /too short/)
  assert.deepEqual(validateContact({ name: 'A', phone: '+91 98765 43210', email: 'a@b.in' }), {})
})

test('cleanContact trims and lower-cases the email', () => {
  const v = cleanContact({ name: ' Asha ', email: ' ASHA@X.in ', phone: ' 1 ' })
  assert.deepEqual([v.name, v.email, v.phone], ['Asha', 'asha@x.in', '1'])
})

test('findDuplicate: same email (any case) or same phone digits, never itself', () => {
  const all = [c('a', 'OEM', 1, { email: 'asha@x.in', phone: '+91 98765 43210' }), c('b', 'OEM', 2)]
  assert.equal(findDuplicate(all, { name: 'N', email: 'ASHA@x.in' })?.id, 'a')
  assert.equal(findDuplicate(all, { name: 'N', phone: '91-98765-43210' })?.id, 'a')
  assert.equal(findDuplicate(all, { name: 'N', phone: '98765 43210' })?.id, 'a')        // without the +91
  assert.equal(findDuplicate(all, { name: 'N', phone: '0 98765 43211' }), undefined)   // different last digit
  assert.equal(findDuplicate(all, { name: 'N', email: 'asha@x.in' }, 'a'), undefined)
  assert.equal(findDuplicate(all, { name: 'N' }), undefined)
  assert.equal(findDuplicate(all, { name: 'N', phone: '12' }), undefined)
})

test('groupContacts sorts each kind by sort_order and sends unknown kinds to Other', () => {
  const g = groupContacts([c('b', 'OEM', 2), c('a', 'OEM', 1), c('z', 'WEIRD', 1)])
  assert.equal(ids(g.OEM), 'ab')
  assert.equal(ids(g.OTHER), 'z')
  assert.deepEqual(Object.keys(g), ['CUSTOMER', 'BIDDER', 'OEM', 'OTHER'])
})

test('planDrop: reorder inside a column renumbers only what changed', () => {
  const plan = planDrop(base(), 'c', 'OEM', 'a')
  assert.deepEqual(plan, [{ id: 'c', kind: 'OEM', sort_order: 1 }, { id: 'a', kind: 'OEM', sort_order: 2 }, { id: 'b', kind: 'OEM', sort_order: 3 }])
  const after = groupContacts(applyPlan(base(), plan))
  assert.equal(ids(after.OEM), 'cab')
  assert.equal(ids(after.CUSTOMER), 'xy')
})

test('planDrop: to another column, at the end or before a card, closes the gap behind it', () => {
  const end = planDrop(base(), 'a', 'CUSTOMER')
  const g = groupContacts(applyPlan(base(), end))
  assert.equal(ids(g.CUSTOMER), 'xya')
  assert.equal(ids(g.OEM), 'bc')
  assert.deepEqual(g.OEM.map((i) => i.sort_order), [1, 2])
  const before = groupContacts(applyPlan(base(), planDrop(base(), 'b', 'CUSTOMER', 'y')))
  assert.equal(ids(before.CUSTOMER), 'xby')
  assert.equal(ids(before.OEM), 'ac')
})

test('planDrop: into an empty column, and the no-op cases', () => {
  const g = groupContacts(applyPlan(base(), planDrop(base(), 'a', 'BIDDER')))
  assert.equal(ids(g.BIDDER), 'a')
  assert.deepEqual(planDrop(base(), 'c', 'OEM'), [])                // already last in its column
  assert.deepEqual(planDrop(base(), 'a', 'OEM', 'a'), [])           // dropped on itself
  assert.deepEqual(planDrop(base(), 'a', 'OEM', 'b'), [])           // already just before b
  assert.deepEqual(planDrop(base(), 'nope', 'OEM'), [])
  assert.deepEqual(planDrop(base(), 'a', 'MARS'), [])
})

test('parseContactText splits a typed "name (email)"', () => {
  assert.deepEqual(parseContactText('John Doe (john@oem.com)'), { name: 'John Doe', email: 'john@oem.com' })
  assert.deepEqual(parseContactText('John Doe <john@oem.com>'), { name: 'John Doe', email: 'john@oem.com' })
  assert.deepEqual(parseContactText('john@oem.com'), { name: 'john@oem.com', email: 'john@oem.com' })
  assert.deepEqual(parseContactText('  Priya Nair '), { name: 'Priya Nair', email: '' })
  assert.deepEqual(parseContactText(''), { name: '', email: '' })
})

test('oemRowContacts and sourceLabel', () => {
  const list = [c('a', 'OEM', 1, { source: 'OEM_AUTH', source_ref: 'r1', org: 'Dell' }), c('b', 'OEM', 2, { source: 'MANUAL' }), c('d', 'CUSTOMER', 1, { source: 'OEM_AUTH', source_ref: 'r1' })]
  assert.equal(ids(oemRowContacts(list, 'r1')), 'ad')
  assert.deepEqual(oemRowContacts(list, 'r2'), [])
  assert.equal(sourceLabel(list[0]), 'OEM Authorization · Dell')
  assert.equal(sourceLabel(list[1]), '')
})

test('contactsSignature changes with any edit or move', () => {
  const a = contactsSignature(base())
  assert.equal(contactsSignature(base()), a)
  assert.notEqual(contactsSignature(applyPlan(base(), planDrop(base(), 'a', 'CUSTOMER'))), a)
  assert.notEqual(contactsSignature(base().map((x) => ({ ...x, updated_at: '2' }))), a)
})
