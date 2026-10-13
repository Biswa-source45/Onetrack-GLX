// Run: node --test frontend/src/lib/sheetColumns.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { SHEET_COLUMNS, EDITABLE_SHEET_COLUMNS } from './sheetColumns.js'
import { formatAmount } from './tenderFormat.js'

const keys = (list) => list.map((c) => c.key)
const labels = (list) => list.map((c) => c.label)

test('the first columns are exactly the agreed order and names', () => {
  assert.deepEqual(labels(SHEET_COLUMNS).slice(0, 10), [
    'Tender Title', 'Status', 'Account Name', 'Department / Ministry', 'Location',
    'Bid Number / RFP Number', 'High-Level Scope', 'End Date', 'Estimated Tender Value (₹)', 'EMD Amount (₹)',
  ])
})

test('every column appears once, with a name and a width', () => {
  assert.equal(new Set(keys(SHEET_COLUMNS)).size, SHEET_COLUMNS.length)
  assert.equal(new Set(labels(SHEET_COLUMNS)).size, SHEET_COLUMNS.length)
  for (const c of SHEET_COLUMNS) assert.ok(c.label && c.minWidth > 0, c.key)
})

test('Workflow Stage is not a sheet column', () => {
  assert.ok(!keys(SHEET_COLUMNS).some((k) => /stage/i.test(k)))
  assert.ok(!labels(SHEET_COLUMNS).some((l) => /workflow|stage/i.test(l)))
})

test('the editable sheet is the Master Sheet minus its read-only extras, in the same order', () => {
  assert.deepEqual(keys(SHEET_COLUMNS.filter((c) => !c.masterOnly)), keys(EDITABLE_SHEET_COLUMNS))
  assert.deepEqual(SHEET_COLUMNS.filter((c) => c.masterOnly).map((c) => c.key), ['created_at', 'account_manager'])
  // the extras sit after Owner, before Remarks, and never in the first ten
  const k = keys(SHEET_COLUMNS)
  assert.ok(k.indexOf('created_at') > k.indexOf('owner') && k.indexOf('account_manager') < k.indexOf('remarks'))
})

test('formatAmount: full number, Indian grouping, no symbol', () => {
  assert.equal(formatAmount(240000), '2,40,000')
  assert.equal(formatAmount(5000000), '50,00,000')
  assert.equal(formatAmount(1234.5), '1,234.5')
  assert.equal(formatAmount(1234.567), '1,234.57')
  assert.equal(formatAmount(0), '0')
  assert.equal(formatAmount(null), '—')
  assert.equal(formatAmount(undefined), '—')
  assert.equal(formatAmount(''), '—')
  assert.equal(formatAmount('abc'), '—')
})
