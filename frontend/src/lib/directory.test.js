// Run: node --test frontend/src/lib/directory.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { KINDS, validateEntry, validateDirectoryContact, filterEntries, entryPayload, contactPayload } from './directory.js'

test('both lists are configured with their own wording and path', () => {
  assert.equal(KINDS.accounts.path, '/dashboard/accounts')
  assert.equal(KINDS.oems.path, '/dashboard/oems')
  assert.equal(KINDS.oems.hasWebsite, true)
  assert.equal(KINDS.accounts.hasWebsite, false)
})

test('validateEntry: name is required, website must be http(s) when given', () => {
  assert.deepEqual(validateEntry({ name: 'IIT Bhubaneswar' }), {})
  assert.equal(validateEntry({ name: '  ' }).name, 'Name is required')
  assert.match(validateEntry({ name: 'a', website: 'dell.com' }).website, /http/)
  assert.match(validateEntry({ name: 'a', website: 'javascript:alert(1)' }).website, /http/)
  assert.deepEqual(validateEntry({ name: 'a', website: 'https://dell.com' }), {})
})

test('payloads are trimmed and the email lower-cased', () => {
  assert.deepEqual(entryPayload({ name: ' IIM ', sector: ' Institute ', extra: 'x' }), { name: 'IIM', sector: 'Institute', location: '', website: '', notes: '' })
  assert.equal(contactPayload({ name: ' A ', email: ' A@B.IN ' }).email, 'a@b.in')
})

test('validateDirectoryContact: field rules and duplicates inside the record', () => {
  const all = [{ id: '1', name: 'Asha', email: 'asha@x.in', phone: '+91 98765 43210' }]
  assert.equal(validateDirectoryContact({ name: '' }, all).name, 'Name is required')
  assert.match(validateDirectoryContact({ name: 'B', email: 'nope' }, all).email, /not valid/)
  assert.match(validateDirectoryContact({ name: 'B', email: 'ASHA@x.in' }, all).email, /Asha already/)
  assert.match(validateDirectoryContact({ name: 'B', phone: '9876543210' }, all).phone, /Asha already/)
  assert.deepEqual(validateDirectoryContact({ name: 'Asha', email: 'asha@x.in' }, all, '1'), {})
})

test('filterEntries matches name, sector or location, any case', () => {
  const list = [{ name: 'IIT Delhi', sector: 'Institute', location: 'Delhi' }, { name: 'NIC', sector: 'PSU', location: 'Pune' }]
  assert.equal(filterEntries(list, '').length, 2)
  assert.deepEqual(filterEntries(list, 'psu').map((e) => e.name), ['NIC'])
  assert.deepEqual(filterEntries(list, 'DELHI').map((e) => e.name), ['IIT Delhi'])
  assert.equal(filterEntries(list, 'zzz').length, 0)
})
