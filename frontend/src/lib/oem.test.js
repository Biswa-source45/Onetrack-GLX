// Run: node --test frontend/src/lib/oem.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { oemKey, confirmedOems, reconcileOemRows, readOemRows } from './oem.js'

const row = (name, extra = {}) => ({ id: name + Math.random(), name, origin: 'presales', initiated: 'NO', initiatedByName: '', contactName: '', contactEmail: '', docStatus: {}, maf: 'NOT RECEIVED', compliance: 'NA', followUp: '', followUps: [], remark: '', ...extra })
const makeRow = (n) => row(n)
const bid = (sel, finalized = true, ws = []) => ({ primary_review: { amOemSelections: sel, ...(finalized ? { amOemFinalizedAt: 'x' } : {}) }, oem_workspace: ws })
const names = (rs) => rs.map((r) => r.name)

test('oemKey ignores case and spacing', () => {
  assert.equal(oemKey('  Dell   Technologies '), oemKey('dell technologies'))
})

test('confirmedOems: only finalized selections, deduped, null when never finalized', () => {
  assert.deepEqual(confirmedOems(bid({ 0: 'Dell', 1: ' dell ', 2: 'HP' })), ['Dell', 'HP'])
  assert.equal(confirmedOems(bid({ 0: 'Dell' }, false)), null)
  assert.deepEqual(confirmedOems(bid({})), [])
})

test('duplicates merge (case/space), keeping the row with progress', () => {
  const a = row('Dell'), b = row('dell ', { maf: 'RECEIVED' })
  const out = reconcileOemRows([a, b], ['Dell'])
  assert.equal(out.length, 1)
  assert.equal(out[0], b)
})

test('unconfirmed + untouched is pruned; unconfirmed with progress is kept; manual is kept', () => {
  const stale = row('Cisco'), worked = row('Lenovo', { followUps: [{ id: 1 }] }), mine = row('Acme', { origin: 'manual' })
  const out = reconcileOemRows([stale, worked, mine, row('Dell')], ['Dell'])
  assert.deepEqual(names(out), ['Lenovo', 'Acme', 'Dell'])
})

test('missing confirmed OEMs are added, dismissed ones are not', () => {
  const out = reconcileOemRows([], ['Dell', 'HP'], { makeRow, dismissed: new Set(['hp']) })
  assert.deepEqual(names(out), ['Dell'])
})

test('null confirmed list (legacy tender) only dedupes - never prunes or adds', () => {
  const rows = [row('Cisco'), row('cisco'), row('Dell')]
  assert.deepEqual(names(reconcileOemRows(rows, null, { makeRow })), ['Cisco', 'Dell'])
})

test('idempotent and identity-stable once clean', () => {
  const clean = reconcileOemRows([row('Cisco'), row('Dell')], ['Dell'], { makeRow })
  const again = reconcileOemRows(clean, ['Dell'], { makeRow })
  assert.equal(again.length, clean.length)
  assert.ok(again.every((r, i) => r === clean[i]))
})

test('a row with a contact in the shared list is worked on, so it is never dropped', () => {
  const quiet = row('Cisco', { id: 'r1' })
  assert.deepEqual(names(reconcileOemRows([quiet, row('Dell')], ['Dell'])), ['Dell'])
  assert.deepEqual(names(reconcileOemRows([quiet, row('Dell')], ['Dell'], { withContacts: new Set(['r1']) })), ['Cisco', 'Dell'])
  assert.deepEqual(names(readOemRows({ ...bid({ 0: 'Dell' }, true, [quiet, row('Dell')]), contacts: [{ source: 'OEM_AUTH', source_ref: 'r1' }] })), ['Cisco', 'Dell'])
})

test('readOemRows reads both workspace shapes and cleans for display', () => {
  const ws = [row('Dell'), row('Cisco')]
  assert.deepEqual(names(readOemRows(bid({ 0: 'Dell' }, true, ws))), ['Dell'])
  assert.deepEqual(names(readOemRows(bid({ 0: 'Dell' }, true, { oems: ws }))), ['Dell'])
  assert.deepEqual(names(readOemRows(bid({ 0: 'Dell' }, false, ws))), ['Dell', 'Cisco'])
})
