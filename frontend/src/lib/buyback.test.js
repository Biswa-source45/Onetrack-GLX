// Run: node --test frontend/src/lib/buyback.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buybackLines, buybackTotal, buybackSummary, buybackDraft, validateBuybackDraft } from './buyback.js'

test('draft rows come back as strings, legacy value included, disabled lines kept', () => {
  assert.deepEqual(buybackDraft({ enabled: false, items: [{ id: 'a', product: 'PC', qty: 2, unitPrice: 10 }] }), [{ id: 'a', product: 'PC', qty: '2', unitPrice: '10' }])
  assert.equal(buybackDraft({ enabled: true, item: 'Old', value: 500 })[0].unitPrice, '500')
  assert.deepEqual(buybackDraft({ enabled: false, item: '', value: '' }), [])
})

test('lines multiply qty by unit price and add up', () => {
  const lines = buybackLines({ enabled: true, items: [
    { product: 'Desktop', qty: '5', unitPrice: '2500' },
    { product: ' Server ', qty: 1, unitPrice: 18000.5 },
    { product: 'CPU', qty: 10, unitPrice: 750 },
  ] })
  assert.deepEqual(lines.map((l) => l.total), [12500, 18000.5, 7500])
  assert.equal(lines[1].product, 'Server')
  assert.equal(buybackTotal(lines), 38000.5)
  assert.equal(buybackSummary(lines), 'Desktop ×5, Server ×1, CPU ×10')
})

test('a disabled or empty buyback is nothing', () => {
  assert.deepEqual(buybackLines(undefined), [])
  assert.deepEqual(buybackLines({ enabled: false, items: [{ product: 'x', qty: 1, unitPrice: 100 }] }), [])
  assert.equal(buybackTotal(buybackLines({ enabled: true, items: [] })), 0)
})

test('a sheet saved before multi-product buyback is read as one line', () => {
  const lines = buybackLines({ enabled: true, item: 'Old laptops — 50 units', value: 125000 })
  assert.equal(lines.length, 1)
  assert.equal(lines[0].product, 'Old laptops — 50 units')
  assert.equal(buybackTotal(lines), 125000)
})

test('bad numbers and negatives never lower or break the total', () => {
  const lines = buybackLines({ enabled: true, items: [
    { product: 'a', qty: -2, unitPrice: 100 },
    { product: 'b', qty: 'x', unitPrice: 100 },
    { product: 'c', qty: 2, unitPrice: 0.1 },
    { product: 'd', qty: 3, unitPrice: 0.2 },
  ] })
  assert.equal(buybackTotal(lines), 0.8)
})

test('draft validation names the line that is wrong', () => {
  assert.match(validateBuybackDraft([]), /at least one/)
  assert.match(validateBuybackDraft([{ product: '', qty: '1', unitPrice: '5' }]), /Line 1: enter the product/)
  assert.match(validateBuybackDraft([{ product: 'a', qty: '1', unitPrice: '5' }, { product: 'b', qty: '1.5', unitPrice: '5' }]), /Line 2: quantity/)
  assert.match(validateBuybackDraft([{ product: 'a', qty: '1', unitPrice: '0' }]), /Line 1: unit price/)
  assert.equal(validateBuybackDraft([{ product: 'a', qty: '2', unitPrice: '5' }]), '')
})
