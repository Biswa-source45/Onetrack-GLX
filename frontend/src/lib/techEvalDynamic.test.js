// Run: node --test frontend/src/lib/techEvalDynamic.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TECH_EVAL_FIELDS,
  getActiveTechEvalFields,
  getAvailableTechEvalFields,
} from '../services/techEval.js'

test('when no dates are set, active list is empty and all fields are available', () => {
  const dates = {}
  const active = getActiveTechEvalFields(dates)
  const available = getAvailableTechEvalFields(dates)

  assert.equal(active.length, 0)
  assert.equal(available.length, 5)
  assert.deepEqual(available.map((f) => f.key), [
    'bidExtension',
    'evaluation',
    'clarification',
    'negotiation',
    'reverseAuction',
  ])
})

test('when a specific date is added, only that field appears in active list', () => {
  const dates = { clarification: '2026-11-20' }
  const active = getActiveTechEvalFields(dates)
  const available = getAvailableTechEvalFields(dates)

  assert.equal(active.length, 1)
  assert.equal(active[0].key, 'clarification')
  assert.equal(active[0].label, 'Technical Clarification Date')

  assert.equal(available.length, 4)
  assert.equal(available.some((f) => f.key === 'clarification'), false)
})

test('multiple active dates are tracked dynamically', () => {
  const dates = {
    evaluation: '2026-11-15',
    reverseAuction: '2026-11-28',
  }
  const active = getActiveTechEvalFields(dates)
  const available = getAvailableTechEvalFields(dates)

  assert.equal(active.length, 2)
  assert.deepEqual(active.map((f) => f.key), ['evaluation', 'reverseAuction'])

  assert.equal(available.length, 3)
  assert.deepEqual(available.map((f) => f.key), [
    'bidExtension',
    'clarification',
    'negotiation',
  ])
})

test('removing or clearing a date field removes it from active and restores it to available', () => {
  const dates = {
    evaluation: '2026-11-15',
    clarification: '2026-11-20',
  }
  assert.equal(getActiveTechEvalFields(dates).length, 2)

  // Clear clarification
  delete dates.clarification
  const activeAfterDelete = getActiveTechEvalFields(dates)
  const availableAfterDelete = getAvailableTechEvalFields(dates)

  assert.equal(activeAfterDelete.length, 1)
  assert.equal(activeAfterDelete[0].key, 'evaluation')
  assert.equal(availableAfterDelete.some((f) => f.key === 'clarification'), true)

  // Empty string also counts as inactive
  const datesWithEmpty = { evaluation: '2026-11-15', clarification: '' }
  assert.equal(getActiveTechEvalFields(datesWithEmpty).length, 1)
  assert.equal(getAvailableTechEvalFields(datesWithEmpty).some((f) => f.key === 'clarification'), true)
})

test('when all 5 dates are added, available list is empty', () => {
  const dates = {
    bidExtension: '2026-11-10',
    evaluation: '2026-11-15',
    clarification: '2026-11-20',
    negotiation: '2026-11-25',
    reverseAuction: '2026-11-30',
  }
  const active = getActiveTechEvalFields(dates)
  const available = getAvailableTechEvalFields(dates)

  assert.equal(active.length, 5)
  assert.equal(available.length, 0)
})

test('custom milestone dates in dates map are preserved in active list', () => {
  const dates = {
    evaluation: '2026-11-15',
    samplePresentation: '2026-11-22',
  }
  const active = getActiveTechEvalFields(dates)
  assert.equal(active.length, 2)
  assert.equal(active[0].key, 'evaluation')
  assert.equal(active[1].key, 'samplePresentation')
})

