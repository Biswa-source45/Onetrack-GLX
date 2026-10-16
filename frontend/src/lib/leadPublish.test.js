// Run: node --test frontend/src/lib/leadPublish.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { PUBLISHED_BLANK, blankProducts, buildPublishPayload, buildPublishedDetails, validatePublished } from './leadPublish.js'

test('a tender title is required, and so is an EMD choice (or "No EMD")', () => {
  const noEmd = { ...PUBLISHED_BLANK, emd_not_applicable: true }
  assert.equal(validatePublished({ ...noEmd }, false, false).title, 'Tender title is required')
  assert.equal(validatePublished({ ...noEmd, title: '  ' }, false, false).title, 'Tender title is required')
  assert.deepEqual(validatePublished({ ...noEmd, title: 'Supply of Laptops' }, false, false), {})
  assert.ok(validatePublished({ ...PUBLISHED_BLANK, title: 'Supply of Laptops' }, false, false).emd_mode, 'no EMD mode chosen is flagged')
})

test('the payload trims the title and keeps only filled products', () => {
  const products = [
    { id: 1, product: 'Laptop', description: 'i7', qty: '10', oem: 'Dell', extra: 'x' },
    { id: 2, product: ' ', description: '', qty: '', oem: '' },
  ]
  const p = buildPublishPayload({ ...PUBLISHED_BLANK, title: '  Supply  ', gem_bid_no: ' GEM/1 ', quantity: '5' }, products, false, false)
  assert.equal(p.title, 'Supply')
  assert.equal(p.published_details.gem_bid_no, 'GEM/1')
  assert.equal(p.published_details.quantity, 5)
  assert.deepEqual(p.published_details.requested_products, [{ product: 'Laptop', description: 'i7', qty: '10', oem: 'Dell' }])
})

test('blank optional fields are left out, and BG details only count when BG is required', () => {
  const d = buildPublishedDetails({ ...PUBLISHED_BLANK, title: 't', bg_rate: '3', bg_duration_months: '12' }, blankProducts(), false, false)
  assert.equal(d.gem_bid_no, undefined)
  assert.equal(d.end_date, undefined)
  assert.equal(d.bg_rate, undefined)
  const withBg = buildPublishedDetails({ ...PUBLISHED_BLANK, title: 't', bg_required: true, bg_rate: '3', bg_duration_months: '12' }, blankProducts(), false, false)
  assert.equal(withBg.bg_rate, 3)
  assert.equal(withBg.bg_duration_months, 12)
})
