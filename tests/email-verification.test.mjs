import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { handleSendVerificationEmailRequest } from '../lib/email-verification-endpoint.ts'
import { validateEmailVerificationServerConfig } from '../lib/email-verification-server-config.ts'
import { evaluateEmailVerificationRateLimit } from '../lib/email-verification-rate-limit.ts'
import { EmailVerificationRequestError, requestEmailVerificationEmail } from '../lib/email-verification-client.ts'

const now = Date.parse('2026-09-24T12:00:00.000Z')
const actionCodeSettings = {
  url: 'https://runbee.pl/login?verified=1',
  handleCodeInApp: false,
}

function deps(patch = {}) {
  const calls = {
    rateLimit: 0,
    generate: 0,
    send: 0,
    generatedForEmail: null,
    sentTo: null,
    sentFirstName: null,
  }
  return {
    calls,
    deps: {
      actionCodeSettings,
      now: () => now,
      verifyIdToken: async (token) => {
        if (token === 'invalid') throw new Error('invalid token')
        return { uid: 'user-1' }
      },
      getUser: async (uid) => ({
        uid,
        email: 'real-user@runbee.pl',
        emailVerified: false,
        displayName: 'Anna Kowalska',
      }),
      getFirstName: async () => 'Anna',
      checkRateLimit: async () => {
        calls.rateLimit += 1
        return { allowed: true }
      },
      generateEmailVerificationLink: async (email) => {
        calls.generate += 1
        calls.generatedForEmail = email
        return 'https://firebase.example/action?mode=verifyEmail&oobCode=SECRET_CODE'
      },
      sendEmailVerificationEmail: async (input) => {
        calls.send += 1
        calls.sentTo = input.to
        calls.sentFirstName = input.firstName
      },
      logDiagnostic: () => {},
      ...patch,
    },
  }
}

function diagnosticError(diagnosticCode, httpStatus, operation, extra = {}) {
  const err = new Error('diagnostic test error')
  err.diagnosticCode = diagnosticCode
  err.httpStatus = httpStatus
  err.operation = operation
  Object.assign(err, extra)
  return err
}

test('verification endpoint rejects missing Authorization', async () => {
  const setup = deps()
  const result = await handleSendVerificationEmailRequest(null, setup.deps)

  assert.equal(result.status, 401)
  assert.equal(setup.calls.send, 0)
})

test('verification endpoint rejects malformed Authorization', async () => {
  const setup = deps()
  const result = await handleSendVerificationEmailRequest('Token abc', setup.deps)

  assert.equal(result.status, 401)
  assert.equal(setup.calls.send, 0)
})

test('verification endpoint rejects invalid Firebase token', async () => {
  const setup = deps()
  const result = await handleSendVerificationEmailRequest('Bearer invalid', setup.deps)

  assert.equal(result.status, 401)
  assert.equal(setup.calls.send, 0)
})

test('verification endpoint returns server error for verifyIdToken config failure', async () => {
  const setup = deps({
    verifyIdToken: async () => {
      throw diagnosticError(
        'firebase_auth_config_missing',
        503,
        'accounts.lookup.verify_id_token',
        { missingEnv: 'NEXT_PUBLIC_FIREBASE_API_KEY' },
      )
    },
  })
  const result = await handleSendVerificationEmailRequest('Bearer valid', setup.deps)

  assert.notEqual(result.status, 401)
  assert.equal(result.status, 503)
  assert.equal(setup.calls.send, 0)
})

test('verification endpoint returns server error for getUser IAM failure', async () => {
  const setup = deps({
    getUser: async () => {
      throw diagnosticError(
        'firebase_auth_iam_error',
        503,
        'projects.accounts.lookup',
        { googleHttpStatus: 403, googleErrorCode: 'PERMISSION_DENIED' },
      )
    },
  })
  const result = await handleSendVerificationEmailRequest('Bearer valid', setup.deps)

  assert.notEqual(result.status, 401)
  assert.equal(result.status, 503)
  assert.equal(setup.calls.send, 0)
})

test('verified user gets neutral success without email send', async () => {
  const setup = deps({
    getUser: async (uid) => ({ uid, email: 'verified@runbee.pl', emailVerified: true }),
  })
  const result = await handleSendVerificationEmailRequest('Bearer valid', setup.deps)

  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.equal(result.body.alreadyVerified, true)
  assert.equal(setup.calls.rateLimit, 0)
  assert.equal(setup.calls.send, 0)
})

test('verification server config validation catches missing env', () => {
  const result = validateEmailVerificationServerConfig({
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'runbee-prod',
    FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify({ project_id: 'runbee-prod' }),
    RESEND_API_KEY: 'resend-key',
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
  assert.equal(result.diagnosticCode, 'firebase_auth_config_missing')
  assert.equal(result.missingEnv, 'NEXT_PUBLIC_FIREBASE_API_KEY')
})

test('verification server config validation catches project mismatch', () => {
  const result = validateEmailVerificationServerConfig({
    NEXT_PUBLIC_FIREBASE_API_KEY: 'firebase-api-key',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'runbee-prod',
    FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify({ project_id: 'different-project' }),
    RESEND_API_KEY: 'resend-key',
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
  assert.equal(result.diagnosticCode, 'firebase_auth_project_mismatch')
})

test('user without email gets safe error', async () => {
  const setup = deps({
    getUser: async (uid) => ({ uid, emailVerified: false }),
  })
  const result = await handleSendVerificationEmailRequest('Bearer valid', setup.deps)

  assert.equal(result.status, 400)
  assert.equal(setup.calls.send, 0)
})

test('verification endpoint generates and sends branded email for server-side auth email', async () => {
  const setup = deps()
  const result = await handleSendVerificationEmailRequest('Bearer valid', setup.deps)

  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.equal(setup.calls.generatedForEmail, 'real-user@runbee.pl')
  assert.equal(setup.calls.sentTo, 'real-user@runbee.pl')
  assert.equal(setup.calls.sentFirstName, 'Anna')
})

test('verification endpoint does not accept arbitrary email as source of truth', async () => {
  const setup = deps()
  await handleSendVerificationEmailRequest('Bearer valid', setup.deps)

  assert.notEqual(setup.calls.sentTo, 'attacker@example.com')
  assert.equal(setup.calls.sentTo, 'real-user@runbee.pl')
})

test('verification endpoint returns 429 and Retry-After when rate limited', async () => {
  const setup = deps({
    checkRateLimit: async () => ({ allowed: false, retryAfterSeconds: 37 }),
  })
  const result = await handleSendVerificationEmailRequest('Bearer valid', setup.deps)

  assert.equal(result.status, 429)
  assert.equal(result.headers?.['Retry-After'], '37')
  assert.equal(result.body.retryAfterSeconds, 37)
  assert.equal(setup.calls.generate, 0)
  assert.equal(setup.calls.send, 0)
})

test('cooldown blocks attempts inside 60 seconds', () => {
  const result = evaluateEmailVerificationRateLimit({ lastSentAt: now - 10_000, attempts: [now - 10_000] }, now)

  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'cooldown')
  assert.equal(result.retryAfterSeconds, 50)
})

test('hourly limit blocks more than 5 attempts per 60 minutes', () => {
  const attempts = [now - 50 * 60_000, now - 40 * 60_000, now - 30 * 60_000, now - 20 * 60_000, now - 70_000]
  const result = evaluateEmailVerificationRateLimit({ lastSentAt: now - 70_000, attempts }, now)

  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'hourly_limit')
  assert.equal(result.retryAfterSeconds, 600)
})

test('generateEmailVerificationLink failure returns safe error without leaking link or token', async () => {
  const setup = deps({
    generateEmailVerificationLink: async () => {
      throw new Error('provider failure with oobCode=SECRET_CODE')
    },
  })
  const result = await handleSendVerificationEmailRequest('Bearer token_WITH_SECRET', setup.deps)
  const payload = JSON.stringify(result.body)

  assert.equal(result.status, 500)
  assert.equal(payload.includes('SECRET_CODE'), false)
  assert.equal(payload.includes('token_WITH_SECRET'), false)
})

test('Resend failure returns safe error without leaking verification link', async () => {
  const setup = deps({
    sendEmailVerificationEmail: async () => {
      throw new Error('Resend failed')
    },
  })
  const result = await handleSendVerificationEmailRequest('Bearer valid', setup.deps)
  const payload = JSON.stringify(result.body)

  assert.equal(result.status, 502)
  assert.equal(payload.includes('SECRET_CODE'), false)
  assert.equal(payload.includes('firebase.example'), false)
})

test('client resend flow posts only Authorization token to verification endpoint', async () => {
  let requestUrl = ''
  let requestInit = null
  const fetchImpl = async (url, init) => {
    requestUrl = String(url)
    requestInit = init
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  await requestEmailVerificationEmail('id-token-123', fetchImpl)

  assert.equal(requestUrl, '/api/auth/send-verification-email')
  assert.equal(requestInit.method, 'POST')
  assert.equal(requestInit.headers.Authorization, 'Bearer id-token-123')
  assert.equal(requestInit.body, '{}')
})

test('client resend flow surfaces 429 retry information', async () => {
  const fetchImpl = async () => new Response(
    JSON.stringify({ error: 'Zbyt wiele prób wysyłki. Spróbuj ponownie za chwilę.' }),
    { status: 429, headers: { 'Retry-After': '31' } },
  )

  await assert.rejects(
    () => requestEmailVerificationEmail('id-token-123', fetchImpl),
    (err) => {
      assert.equal(err instanceof EmailVerificationRequestError, true)
      assert.equal(err.status, 429)
      assert.equal(err.retryAfterSeconds, 31)
      assert.equal(err.message.includes('too-many-requests'), true)
      return true
    },
  )
})

test('auth service no longer imports or calls client-side sendEmailVerification', () => {
  const source = readFileSync(new URL('../services/auth.service.ts', import.meta.url), 'utf8')
  assert.equal(/\bsendEmailVerification\b/.test(source), false)
})
