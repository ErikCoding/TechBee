import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PASSWORD_RESET_SUCCESS_MESSAGE,
  buildRunbeeActionLink,
  normalizeEmail,
  runPasswordChangeWithSecurityNotification,
} from '../lib/account-security-core.ts'
import { evaluateAccountSecurityRateLimit } from '../lib/account-security-rate-limit.ts'
import {
  handlePasswordResetRequest,
  handlePasswordChangedNotificationRequest,
  handleRequestEmailChange,
  handleSyncEmailChange,
} from '../lib/account-security-endpoints.ts'

const now = Date.parse('2026-09-24T12:00:00.000Z')
const generatedResetLink = 'https://firebase.example/__/auth/action?mode=resetPassword&oobCode=RESET_SECRET&apiKey=PUBLIC_API_KEY'
const generatedEmailChangeLink = 'https://firebase.example/__/auth/action?mode=verifyAndChangeEmail&oobCode=EMAIL_SECRET&apiKey=PUBLIC_API_KEY'
const actionCodeSettings = { url: 'https://runbee.pl/auth/action', handleCodeInApp: true }

function user(email = 'anna@runbee.pl') {
  return { uid: 'user-1', email, disabled: false }
}

function passwordResetDeps(patch = {}) {
  const calls = { generate: 0, send: 0, sentTo: null, resetLink: null }
  return {
    calls,
    deps: {
      actionCodeSettings,
      siteUrl: 'https://runbee.pl',
      now: () => now,
      checkRateLimit: async () => ({ allowed: true }),
      getUserByEmail: async (email) => user(email),
      generatePasswordResetLink: async () => {
        calls.generate += 1
        return generatedResetLink
      },
      sendPasswordResetEmail: async (input) => {
        calls.send += 1
        calls.sentTo = input.to
        calls.resetLink = input.resetLink
      },
      ...patch,
    },
  }
}

function emailChangeDeps(patch = {}) {
  const calls = { savePending: 0, send: 0, update: 0, saved: null, sentTo: null }
  return {
    calls,
    deps: {
      actionCodeSettings,
      siteUrl: 'https://runbee.pl',
      now: () => now,
      verifyIdToken: async (token) => {
        if (token === 'invalid') throw new Error('invalid token')
        return { uid: 'user-1', auth_time: Math.floor(now / 1000) }
      },
      getUser: async (uid) => user('old@runbee.pl'),
      checkRateLimit: async () => ({ allowed: true }),
      generateVerifyAndChangeEmailLink: async () => generatedEmailChangeLink,
      savePendingEmailChange: async (input) => {
        calls.savePending += 1
        calls.saved = input
      },
      sendEmailChangeVerificationEmail: async (input) => {
        calls.send += 1
        calls.sentTo = input.to
      },
      ...patch,
    },
  }
}

function passwordChangedNotificationDeps(patch = {}) {
  const calls = { send: 0, sentTo: null }
  return {
    calls,
    deps: {
      verifyIdToken: async (token) => {
        if (token === 'invalid') throw new Error('invalid token')
        return { uid: 'user-1', auth_time: Math.floor(now / 1000) }
      },
      getUser: async () => user('anna@runbee.pl'),
      sendPasswordChangedEmail: async (input) => {
        calls.send += 1
        calls.sentTo = input.to
      },
      ...patch,
    },
  }
}

test('password reset returns a neutral response for existing email', async () => {
  const setup = passwordResetDeps()
  const result = await handlePasswordResetRequest({ email: 'Anna@Runbee.PL' }, setup.deps)

  assert.equal(result.status, 200)
  assert.equal(result.body.message, PASSWORD_RESET_SUCCESS_MESSAGE)
  assert.equal(setup.calls.sentTo, 'anna@runbee.pl')
  assert.equal(setup.calls.resetLink, 'https://runbee.pl/auth/action?mode=resetPassword&oobCode=RESET_SECRET&apiKey=PUBLIC_API_KEY')
})

test('password reset returns the same neutral response for missing email', async () => {
  const setup = passwordResetDeps({
    getUserByEmail: async () => {
      const err = new Error('not found')
      err.code = 'auth/user-not-found'
      throw err
    },
  })
  const result = await handlePasswordResetRequest({ email: 'missing@runbee.pl' }, setup.deps)

  assert.equal(result.status, 200)
  assert.equal(result.body.message, PASSWORD_RESET_SUCCESS_MESSAGE)
  assert.equal(setup.calls.generate, 0)
  assert.equal(setup.calls.send, 0)
})

test('password reset rejects invalid email before sending', async () => {
  const setup = passwordResetDeps()
  const result = await handlePasswordResetRequest({ email: 'not-an-email' }, setup.deps)

  assert.equal(result.status, 400)
  assert.equal(setup.calls.send, 0)
})

test('password reset rate limit blocks email sending', async () => {
  const setup = passwordResetDeps({
    checkRateLimit: async () => ({ allowed: false, retryAfterSeconds: 45 }),
  })
  const result = await handlePasswordResetRequest({ email: 'anna@runbee.pl' }, setup.deps)

  assert.equal(result.status, 429)
  assert.equal(result.headers?.['Retry-After'], '45')
  assert.equal(setup.calls.send, 0)
})

test('password reset generation failure does not leak action link or oobCode', async () => {
  const setup = passwordResetDeps({
    generatePasswordResetLink: async () => {
      throw new Error('Firebase failed oobCode=RESET_SECRET')
    },
  })
  const result = await handlePasswordResetRequest({ email: 'anna@runbee.pl' }, setup.deps)
  const payload = JSON.stringify(result.body)

  assert.equal(result.status, 500)
  assert.equal(payload.includes('RESET_SECRET'), false)
  assert.equal(payload.includes('firebase.example'), false)
})

test('password reset Resend failure does not leak generated reset link', async () => {
  const setup = passwordResetDeps({
    sendPasswordResetEmail: async () => {
      throw new Error('Resend failed')
    },
  })
  const result = await handlePasswordResetRequest({ email: 'anna@runbee.pl' }, setup.deps)
  const payload = JSON.stringify(result.body)

  assert.equal(result.status, 502)
  assert.equal(payload.includes('RESET_SECRET'), false)
  assert.equal(payload.includes('firebase.example'), false)
})

test('password changed notification email is sent for the authenticated user', async () => {
  const setup = passwordChangedNotificationDeps()
  const result = await handlePasswordChangedNotificationRequest('Bearer valid', setup.deps)

  assert.equal(result.status, 200)
  assert.equal(setup.calls.send, 1)
  assert.equal(setup.calls.sentTo, 'anna@runbee.pl')
})

test('password changed notification email is not sent for invalid auth', async () => {
  const setup = passwordChangedNotificationDeps()
  const result = await handlePasswordChangedNotificationRequest('Bearer invalid', setup.deps)

  assert.equal(result.status, 401)
  assert.equal(setup.calls.send, 0)
})

test('security notification is sent only after successful password change', async () => {
  const events = []
  await runPasswordChangeWithSecurityNotification({
    changePassword: async () => { events.push('password-changed') },
    getIdToken: async () => 'id-token',
    notifyPasswordChanged: async (token) => { events.push(`notified:${token}`) },
  })

  assert.deepEqual(events, ['password-changed', 'notified:id-token'])
})

test('security notification is not sent after failed password change', async () => {
  let notified = false
  await assert.rejects(
    () => runPasswordChangeWithSecurityNotification({
      changePassword: async () => { throw new Error('updatePassword failed') },
      getIdToken: async () => 'id-token',
      notifyPasswordChanged: async () => { notified = true },
    }),
    /updatePassword failed/,
  )

  assert.equal(notified, false)
})

test('security notification failure does not roll back successful password change', async () => {
  let changed = false
  await runPasswordChangeWithSecurityNotification({
    changePassword: async () => { changed = true },
    getIdToken: async () => 'id-token',
    notifyPasswordChanged: async () => { throw new Error('Resend failed') },
  })

  assert.equal(changed, true)
})

test('account security cooldown and hourly limit work for password reset/email change', () => {
  const cooldown = evaluateAccountSecurityRateLimit({ lastSentAt: now - 10_000, attempts: [now - 10_000] }, now)
  const hourly = evaluateAccountSecurityRateLimit({
    lastSentAt: now - 70_000,
    attempts: [now - 50 * 60_000, now - 40 * 60_000, now - 30 * 60_000, now - 20 * 60_000, now - 70_000],
  }, now)

  assert.equal(cooldown.allowed, false)
  assert.equal(cooldown.reason, 'cooldown')
  assert.equal(hourly.allowed, false)
  assert.equal(hourly.reason, 'hourly_limit')
})

test('email change requires Authorization', async () => {
  const setup = emailChangeDeps()
  const result = await handleRequestEmailChange(null, { newEmail: 'new@runbee.pl' }, setup.deps)

  assert.equal(result.status, 401)
  assert.equal(setup.calls.send, 0)
})

test('email change rejects invalid token', async () => {
  const setup = emailChangeDeps()
  const result = await handleRequestEmailChange('Bearer invalid', { newEmail: 'new@runbee.pl' }, setup.deps)

  assert.equal(result.status, 401)
  assert.equal(setup.calls.send, 0)
})

test('email change rejects invalid and same email', async () => {
  const invalid = emailChangeDeps()
  const same = emailChangeDeps()

  const invalidResult = await handleRequestEmailChange('Bearer valid', { newEmail: 'bad' }, invalid.deps)
  const sameResult = await handleRequestEmailChange('Bearer valid', { newEmail: 'old@runbee.pl' }, same.deps)

  assert.equal(invalidResult.status, 400)
  assert.equal(sameResult.status, 400)
  assert.equal(invalid.calls.send, 0)
  assert.equal(same.calls.send, 0)
})

test('email change requires recent Firebase auth_time', async () => {
  const setup = emailChangeDeps({
    verifyIdToken: async () => ({ uid: 'user-1', auth_time: Math.floor((now - 10 * 60_000) / 1000) }),
  })
  const result = await handleRequestEmailChange('Bearer valid', { newEmail: 'new@runbee.pl' }, setup.deps)

  assert.equal(result.status, 401)
  assert.equal(result.body.code, 'requires-recent-login')
  assert.equal(setup.calls.send, 0)
})

test('email change rate limit blocks action link generation', async () => {
  const setup = emailChangeDeps({
    checkRateLimit: async () => ({ allowed: false, retryAfterSeconds: 61 }),
  })
  const result = await handleRequestEmailChange('Bearer valid', { newEmail: 'new@runbee.pl' }, setup.deps)

  assert.equal(result.status, 429)
  assert.equal(setup.calls.savePending, 0)
  assert.equal(setup.calls.send, 0)
})

test('email change uses verified uid/current email and stores pending without updating Firestore', async () => {
  const setup = emailChangeDeps()
  const result = await handleRequestEmailChange('Bearer valid', {
    uid: 'attacker',
    currentEmail: 'attacker@runbee.pl',
    newEmail: 'new@runbee.pl',
  }, setup.deps)

  assert.equal(result.status, 200)
  assert.equal(setup.calls.saved.uid, 'user-1')
  assert.equal(setup.calls.saved.currentEmail, 'old@runbee.pl')
  assert.equal(setup.calls.saved.newEmail, 'new@runbee.pl')
  assert.equal(setup.calls.saved.oobCode, 'EMAIL_SECRET')
  assert.equal(setup.calls.sentTo, 'new@runbee.pl')
})

test('email change sync updates Firestore only after Firebase Auth has the new email', async () => {
  let updated = null
  let consumed = false
  const result = await handleSyncEmailChange({ oobCode: 'EMAIL_SECRET' }, {
    now: () => now,
    getPendingEmailChange: async () => ({
      uid: 'user-1',
      currentEmail: 'old@runbee.pl',
      newEmail: 'new@runbee.pl',
      oobCodeHash: 'hash',
      createdAt: now - 1000,
      expiresAt: now + 1000,
    }),
    getUser: async () => user('new@runbee.pl'),
    updateUserEmail: async (uid, email) => {
      updated = { uid, email }
    },
    markPendingEmailChangeConsumed: async () => {
      consumed = true
    },
  })

  assert.equal(result.status, 200)
  assert.deepEqual(updated, { uid: 'user-1', email: 'new@runbee.pl' })
  assert.equal(consumed, true)
})

test('email change sync rejects invalid/expired action and does not update Firestore', async () => {
  let updated = false
  const result = await handleSyncEmailChange({ oobCode: 'EXPIRED' }, {
    now: () => now,
    getPendingEmailChange: async () => null,
    getUser: async () => user('new@runbee.pl'),
    updateUserEmail: async () => {
      updated = true
    },
    markPendingEmailChangeConsumed: async () => {},
  })

  assert.equal(result.status, 400)
  assert.equal(updated, false)
})

test('email change sync refuses to update before Firebase Auth email changes', async () => {
  let updated = false
  const result = await handleSyncEmailChange({ oobCode: 'EMAIL_SECRET' }, {
    now: () => now,
    getPendingEmailChange: async () => ({
      uid: 'user-1',
      currentEmail: 'old@runbee.pl',
      newEmail: 'new@runbee.pl',
      oobCodeHash: 'hash',
      createdAt: now - 1000,
      expiresAt: now + 1000,
    }),
    getUser: async () => user('old@runbee.pl'),
    updateUserEmail: async () => {
      updated = true
    },
    markPendingEmailChangeConsumed: async () => {},
  })

  assert.equal(result.status, 409)
  assert.equal(updated, false)
})

test('action link builder rewrites only expected Firebase modes', () => {
  const reset = buildRunbeeActionLink(generatedResetLink, 'resetPassword', 'https://runbee.pl')

  assert.equal(reset.href, 'https://runbee.pl/auth/action?mode=resetPassword&oobCode=RESET_SECRET&apiKey=PUBLIC_API_KEY')
  assert.throws(() => buildRunbeeActionLink(generatedResetLink, 'verifyAndChangeEmail', 'https://runbee.pl'))
})

test('normalizes valid emails and rejects invalid emails', () => {
  assert.equal(normalizeEmail(' User@Runbee.PL '), 'user@runbee.pl')
  assert.equal(normalizeEmail('bad'), null)
})

test('security operations do not use optional notification preferences', () => {
  const endpointSource = readFileSync(new URL('../lib/account-security-endpoints.ts', import.meta.url), 'utf8')
  assert.equal(endpointSource.includes('notificationPreferences'), false)
})

test('client auth service uses reauthentication and does not call client Firebase email action senders', () => {
  const source = readFileSync(new URL('../services/auth.service.ts', import.meta.url), 'utf8')

  assert.equal(source.includes('reauthenticateWithCredential'), true)
  assert.equal(source.includes('updatePassword'), true)
  assert.equal(/\bsendPasswordResetEmail\s*\(/.test(source), false)
  assert.equal(/\bverifyBeforeUpdateEmail\s*\(/.test(source), false)
  assert.equal(/\bupdateEmail\s*\(/.test(source), false)
})
