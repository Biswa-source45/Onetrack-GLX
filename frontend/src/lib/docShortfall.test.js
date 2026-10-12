// Run: node --test frontend/src/lib/docShortfall.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { openRound, lastRound, awaitingReeval, validateRaise, addRound, patchRound, docCounts, readyForApproval, dueState, approverChoices, newDoc } from './docShortfall.js'

const NOW = Date.parse('2026-10-12T10:00:00Z')
const raise = (ds, extra = {}) => addRound(ds, { deadline: '2026-10-20T10:00:00Z', note: ' hurry ', docs: [{ name: ' PAN card ' }, { name: '' }, { name: 'GST certificate', note: 'latest' }], by: 'Asha', byId: 'u1', ...extra }, new Date(NOW))

test('validateRaise needs a future deadline and at least one named document', () => {
  assert.deepEqual(validateRaise({ deadline: '2026-10-20T10:00', docs: [{ name: 'PAN' }] }, NOW), {})
  assert.match(validateRaise({ docs: [{ name: 'PAN' }] }, NOW).deadline, /date and time/)
  assert.match(validateRaise({ deadline: 'nope', docs: [{ name: 'PAN' }] }, NOW).deadline, /date and time/)
  assert.match(validateRaise({ deadline: '2026-10-01T10:00', docs: [{ name: 'PAN' }] }, NOW).deadline, /future/)
  assert.match(validateRaise({ deadline: '2026-10-20T10:00', docs: [{ name: '  ' }] }, NOW).docs, /at least one/)
  assert.deepEqual(Object.keys(validateRaise({}, NOW)).sort(), ['deadline', 'docs'])
})

test('addRound trims, drops blank documents and numbers the rounds', () => {
  const ds = raise(null)
  assert.equal(ds.rounds.length, 1)
  const r = ds.rounds[0]
  assert.equal(r.n, 1); assert.equal(r.status, 'COLLECTING'); assert.equal(r.note, 'hurry')
  assert.deepEqual(r.docs.map((d) => [d.name, d.note, d.file]), [['PAN card', '', null], ['GST certificate', 'latest', null]])
  assert.equal(new Set(r.docs.map((d) => d.id)).size, 2)
  assert.equal(openRound(ds), r)
})

test('a second round closes an unanswered first one as SHORTFALL', () => {
  let ds = raise(null)
  ds = patchRound(ds, 1, { status: 'SUBMITTED' })
  assert.equal(openRound(ds), null)
  assert.equal(awaitingReeval(ds), true)
  ds = raise(ds)
  assert.equal(ds.rounds[0].outcome, 'SHORTFALL')
  assert.equal(ds.rounds[1].n, 2)
  assert.equal(openRound(ds).n, 2)
  assert.equal(awaitingReeval(ds), false)
})

test('an answered round keeps its outcome when another is raised', () => {
  let ds = patchRound(raise(null), 1, { status: 'SUBMITTED', outcome: 'QUALIFIED' })
  ds = raise(ds)
  assert.equal(ds.rounds[0].outcome, 'QUALIFIED')
  assert.equal(lastRound(ds).n, 2)
})

test('approval needs every document attached', () => {
  let r = raise(null).rounds[0]
  assert.deepEqual(docCounts(r), { total: 2, added: 0 })
  assert.equal(readyForApproval(r), false)
  r = { ...r, docs: r.docs.map((d) => ({ ...d, file: { name: 'a.pdf', url: '/x' } })) }
  assert.equal(readyForApproval(r), true)
  r = { ...r, docs: [...r.docs, newDoc('Extra')] }
  assert.equal(readyForApproval(r), false)
  assert.equal(readyForApproval({ docs: [] }), false)
})

test('dueState', () => {
  assert.deepEqual(dueState('2026-10-12T12:00:00Z', NOW), { state: 'soon', label: '2h left' })
  assert.deepEqual(dueState('2026-10-20T10:00:00Z', NOW), { state: 'ok', label: '8d 0h left' })
  assert.deepEqual(dueState('2026-10-11T07:00:00Z', NOW), { state: 'overdue', label: '1d 3h overdue' })
  assert.equal(dueState('garbage', NOW).state, 'ok')
})

test('approverChoices: RM and AM, else the owner', () => {
  const u = (id, full_name) => ({ id, full_name })
  assert.deepEqual(approverChoices({ reporting_manager: u('r', 'Rita'), account_manager: u('a', 'Amit'), bid_owner: u('o', 'Omar') }).map((c) => c.id), ['r', 'a'])
  assert.deepEqual(approverChoices({ reporting_manager: u('r', 'Rita'), account_manager: u('r', 'Rita') }).map((c) => c.id), ['r'])
  assert.deepEqual(approverChoices({ bid_owner: u('o', 'Omar') }), [{ id: 'o', name: 'Omar', role: 'Bid Owner' }])
  assert.deepEqual(approverChoices(null), [])
})
