// Run: node --test frontend/src/lib/pendingEdit.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { overlayPendingPayload } from './pendingEdit.js'

const bid = {
  id: 'b1',
  title: 'Tender',
  requested_products: [{ product: 'Old', qty: '1' }],
  alert_note: { text: 'live note', label: 'L', color: 'amber' },
  account_manager: { id: 'am-old', full_name: 'Old AM' },
  presales: { id: 'ps-old' },
  bid_owner: { id: 'owner-1' },
  reporting_manager: { id: 'rm-1' },
}

test('no payload returns the bid itself', () => {
  assert.equal(overlayPendingPayload(bid, null), bid)
  assert.equal(overlayPendingPayload(bid, undefined), bid)
})

test('JSON-string products and alert note are parsed, not lost', () => {
  const products = [{ product: 'Server', description: 'rack', qty: '2', oem: 'Dell' }, { product: 'Switch', qty: '1' }]
  const note = { text: 'watch the BG clause', label: 'Heads up', color: 'rose' }
  const out = overlayPendingPayload(bid, { requested_products: JSON.stringify(products), alert_note: JSON.stringify(note) })
  assert.deepEqual(out.requested_products, products)
  assert.deepEqual(out.alert_note, note)
})

test('a proposed empty list / null note is respected, not turned into something else', () => {
  const out = overlayPendingPayload(bid, { requested_products: '[]', alert_note: 'null' })
  assert.deepEqual(out.requested_products, [])
  assert.equal(out.alert_note, null)
})

test('invalid JSON becomes null instead of throwing', () => {
  const out = overlayPendingPayload(bid, { requested_products: '{oops', alert_note: 'nope' })
  assert.equal(out.requested_products, null)
  assert.equal(out.alert_note, null)
})

test('a proposed person replaces the live one; others stay', () => {
  const out = overlayPendingPayload(bid, { account_manager_id: 'am-new', presales_id: 'ps-new' })
  assert.equal(out.account_manager, undefined)
  assert.equal(out.account_manager_id, 'am-new')
  assert.equal(out.presales, undefined)
  assert.equal(out.presales_id, 'ps-new')
  assert.deepEqual(out.bid_owner, { id: 'owner-1' })
  assert.deepEqual(out.reporting_manager, { id: 'rm-1' })
})

test('an empty proposed id means unassigned (does not fall back to the live person)', () => {
  const out = overlayPendingPayload(bid, { account_manager_id: '' })
  assert.equal(out.account_manager, undefined)
  assert.equal(out.account_manager?.id || out.account_manager_id || '', '')
})

test('does not mutate its inputs and is idempotent', () => {
  const payload = { requested_products: '[{"product":"A"}]', account_manager_id: 'x' }
  const before = JSON.stringify([bid, payload])
  const once = overlayPendingPayload(bid, payload)
  assert.equal(JSON.stringify([bid, payload]), before)
  assert.deepEqual(overlayPendingPayload(once, payload), once)
})
