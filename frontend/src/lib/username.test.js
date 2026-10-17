// Run: node --test frontend/src/lib/username.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { usernameFromEmail, nextUsername } from './username.js'

test('username is the part of the email before the @, lower-cased', () => {
  assert.equal(usernameFromEmail('Jane.Smith@globx.co.in'), 'jane.smith')
  assert.equal(usernameFromEmail('  rahul@globx.co.in '), 'rahul')
  assert.equal(usernameFromEmail('rah'), 'rah') // still typing
  assert.equal(usernameFromEmail(''), '')
  assert.equal(usernameFromEmail(null), '')
})

test('username follows the email while untouched, and stops following once typed by hand', () => {
  // typing the email one letter at a time keeps the username in step
  let email = ''
  let user = ''
  for (const ch of 'amit@globx.co.in') {
    const next = email + ch
    user = nextUsername(user, email, next)
    email = next
  }
  assert.equal(user, 'amit')
  // a hand-typed username is never overwritten
  assert.equal(nextUsername('amit.k', 'amit@globx.co.in', 'amit2@globx.co.in'), 'amit.k')
  // clearing the email clears an untouched username
  assert.equal(nextUsername('amit', 'amit@globx.co.in', ''), '')
})
