import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

for (const file of ['firestore.rules', 'storage.rules']) {
  test(`${file}: missing accountStatus is active, only explicit 'deactivated' blocks`, () => {
    const rules = read(file)
    // a bare field read throws "Property accountStatus is undefined" on legacy profiles
    assert.doesNotMatch(rules, /\.data\.accountStatus/)
    assert.match(rules, /\.data\.get\('accountStatus', 'active'\) != 'deactivated'/)
    // the deactivation gate must still exist and still guard isSignedIn
    const fn = rules.slice(rules.indexOf('function isSignedIn()'), rules.indexOf('function isOwner'))
    assert.match(fn, /request\.auth != null/)
    assert.match(fn, /'deactivated'/)
  })
}

test('storage: chat attachment create requires a non-existing object; update stays denied', () => {
  const rules = read('storage.rules')
  const block = rules.slice(rules.indexOf('match /chat-attachments'), rules.indexOf('match /{allPaths=**}'))
  assert.match(block, /allow create: if resource == null\s*&& isOwner\(userId\)\s*&& isConversationParticipant\(conversationId\)/)
  assert.match(block, /8 \* 1024 \* 1024/)
  assert.match(block, /allow update: if false;/)
})

test('financial and server-only protections are untouched by the compat fix', () => {
  const rules = read('firestore.rules')
  for (const field of ['paymentStatus', 'priceGrosze', 'stripeTransferId', 'stripeRefundId', 'platformFeeGrosze']) {
    assert.ok(rules.includes(`'${field}'`), field)
  }
  assert.match(rules, /match \/items\/\{messageId\}[\s\S]*?allow create: if false;/)
  assert.match(rules, /hasOnly\(\['unread', 'participants'\]\)/)
  assert.match(rules, /hasOnly\(\['reportCard'\]\)/)
  assert.match(rules, /allow create: if false;\s*\/\/ Payment-integrity|allow create: if false;/)
})
