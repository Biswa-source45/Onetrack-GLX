// Run: node --test frontend/src/lib/emdAccess.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { EMD_EDIT_ROLES, EMD_VIEW_ROLES, canEditEmd, canViewEmd } from './emdAccess.js'

const as = (...held) => (role) => held.includes(role)

test('Finance and MD/Admin can view and edit; Account Managers can only view', () => {
  for (const r of ['FINANCE', 'FINANCE_MANAGER', 'MANAGING_DIRECTOR', 'ADMIN', 'SUPER_ADMIN']) {
    assert.ok(canViewEmd(as(r)) && canEditEmd(as(r)), r)
  }
  for (const r of ['ACCOUNT_MANAGER', 'SALES_MANAGER', 'ACCOUNTS_MANAGER']) {
    assert.ok(canViewEmd(as(r)), `${r} may open the EMD screens`)
    assert.equal(canEditEmd(as(r)), false, `${r} must not get edit controls: the server refuses every EMD change`)
  }
})

test('everyone else has no access at all', () => {
  for (const r of ['BID_EXECUTIVE', 'BID_MANAGER', 'PRESALES_MANAGER', 'DELIVERY_MANAGER', 'REPORTING_MANAGER']) {
    assert.equal(canViewEmd(as(r)), false, r)
    assert.equal(canEditEmd(as(r)), false, r)
  }
})

test('every editor can also view', () => {
  assert.ok(EMD_EDIT_ROLES.every((r) => EMD_VIEW_ROLES.includes(r)))
})
