// Run: node --test frontend/src/lib/credentialAlert.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultSelection, pruneSelection, toggleId, buildSend, missingPasswords, isFinished, batchPercent } from './credentialAlert.js'

const rows = [{ id: 'a', last_alerted_at: null }, { id: 'b', last_alerted_at: '2026-10-01T00:00:00Z' }, { id: 'c' }]

test('default ticks skip users alerted before, unless included', () => {
  assert.deepEqual([...defaultSelection(rows, false)], ['a', 'c'])
  assert.deepEqual([...defaultSelection(rows, true)], ['a', 'b', 'c'])
})

test('switching the include toggle off drops an alerted user who was ticked', () => {
  assert.deepEqual([...pruneSelection(new Set(['a', 'b']), rows, false)], ['a'])
  assert.deepEqual([...pruneSelection(new Set(['a', 'b']), rows, true)], ['a', 'b'])
})

test('toggleId does not mutate its input', () => {
  const s = new Set(['a'])
  assert.deepEqual([...toggleId(s, 'b')], ['a', 'b'])
  assert.deepEqual([...toggleId(s, 'a')], [])
  assert.deepEqual([...s], ['a'])
})

test('buildSend: a group switched off or empty contributes nothing', () => {
  const r = buildSend({ initialIds: new Set(['a', 'c']), resetIds: new Set(['x']), sendInitial: true, sendReset: false, includeAlerted: false })
  assert.equal(r.initialCount, 2)
  assert.equal(r.resetCount, 0)
  assert.deepEqual(r.payload, { kinds: ['INITIAL'], user_ids: ['a', 'c'], include_alerted: false, passwords: {} })
  const none = buildSend({ initialIds: new Set(), resetIds: new Set(), sendInitial: true, sendReset: true, includeAlerted: false })
  assert.deepEqual(none.payload.kinds, [])
})

test('progress', () => {
  assert.equal(isFinished({ status: 'RUNNING' }), false)
  assert.equal(isFinished({ status: 'DONE' }), true)
  assert.equal(batchPercent({ total: 4, sent: 1, failed: 1 }), 50)
  assert.equal(batchPercent({ total: 0 }), 100)
  assert.equal(batchPercent(null), 0)
})

test('buildSend: admin-set passwords travel only for ticked temp users, and only when that group is on', () => {
  const base = { initialIds: new Set(), resetIds: new Set(), tempIds: new Set(['t1']), passwords: { t1: 'Test@123', t2: 'leak' }, sendInitial: false, sendReset: false, includeAlerted: false }
  const on = buildSend({ ...base, sendTemp: true })
  assert.deepEqual(on.payload, { kinds: ['TEMP_PASSWORD'], user_ids: ['t1'], include_alerted: false, passwords: { t1: 'Test@123' } })
  assert.equal(on.tempCount, 1)
  const off = buildSend({ ...base, sendTemp: false })
  assert.deepEqual(off.payload.kinds, [])
  assert.deepEqual(off.payload.passwords, {})
})

test('missingPasswords flags empty and blank boxes', () => {
  assert.deepEqual(missingPasswords(new Set(['a', 'b', 'c']), { a: 'x', b: '   ' }), ['b', 'c'])
  assert.deepEqual(missingPasswords(new Set(), {}), [])
})
