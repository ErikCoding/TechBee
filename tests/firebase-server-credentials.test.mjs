import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  mintFirebaseAccessToken,
  parseFirebaseServiceAccountKey,
} from '../lib/firebase-server-credentials.ts'
import { runFirebaseAuthDiagnosticChecks } from '../lib/firebase-auth-diagnostics-core.ts'

const validServiceAccount = {
  project_id: 'runbee-prod',
  client_email: 'firebase-adminsdk@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n',
}

function validRaw() {
  return JSON.stringify(validServiceAccount)
}

function validBase64() {
  return Buffer.from(validRaw(), 'utf8').toString('base64')
}

test('Firebase service account parser accepts raw JSON', () => {
  const result = parseFirebaseServiceAccountKey(validRaw(), 'runbee-prod')

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.serviceAccount.project_id, 'runbee-prod')
  assert.equal(result.ok && result.credentialInput.projectId, 'runbee-prod')
  assert.equal(result.ok && result.credentialInput.clientEmail, validServiceAccount.client_email)
  assert.equal(result.ok && result.credentialInput.privateKey, validServiceAccount.private_key)
})

test('Firebase service account parser accepts base64 JSON', () => {
  const result = parseFirebaseServiceAccountKey(validBase64(), 'runbee-prod')

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.serviceAccount.client_email, validServiceAccount.client_email)
})

test('Firebase service account parser reports missing env', () => {
  const result = parseFirebaseServiceAccountKey(undefined, 'runbee-prod')

  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.diagnosticCode, 'firebase_service_account_missing')
  assert.equal(!result.ok && result.missingEnv, 'FIREBASE_SERVICE_ACCOUNT_KEY')
})

test('Firebase service account parser reports malformed JSON/base64', () => {
  const result = parseFirebaseServiceAccountKey('not-json-and-not-base64', 'runbee-prod')

  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.diagnosticCode, 'firebase_service_account_invalid')
  assert.equal(!result.ok && result.invalidField, 'json')
})

test('Firebase service account parser requires project_id', () => {
  const result = parseFirebaseServiceAccountKey(JSON.stringify({
    client_email: validServiceAccount.client_email,
    private_key: validServiceAccount.private_key,
  }), 'runbee-prod')

  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.invalidField, 'project_id')
})

test('Firebase service account parser requires client_email', () => {
  const result = parseFirebaseServiceAccountKey(JSON.stringify({
    project_id: validServiceAccount.project_id,
    private_key: validServiceAccount.private_key,
  }), 'runbee-prod')

  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.invalidField, 'client_email')
})

test('Firebase service account parser requires private_key', () => {
  const result = parseFirebaseServiceAccountKey(JSON.stringify({
    project_id: validServiceAccount.project_id,
    client_email: validServiceAccount.client_email,
  }), 'runbee-prod')

  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.invalidField, 'private_key')
})

test('Firebase service account parser fails closed on project mismatch', () => {
  const result = parseFirebaseServiceAccountKey(validRaw(), 'different-project')

  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.diagnosticCode, 'firebase_project_id_mismatch')
})

test('Firebase credential mint returns OAuth access_token from canonical credential', async () => {
  const state = parseFirebaseServiceAccountKey(validRaw(), 'runbee-prod')
  const token = await mintFirebaseAccessToken({
    getAccessToken: async () => ({ access_token: 'oauth-token' }),
  }, state)

  assert.equal(token, 'oauth-token')
})

test('Firebase credential mint reports token mint failure', async () => {
  const state = parseFirebaseServiceAccountKey(validRaw(), 'runbee-prod')

  await assert.rejects(
    () => mintFirebaseAccessToken({
      getAccessToken: async () => {
        throw new Error('upstream auth failed')
      },
    }, state),
    (err) => {
      assert.equal(err.diagnosticCode, 'firebase_access_token_failed')
      assert.equal(err.httpStatus, 503)
      return true
    },
  )
})

test('Firebase credential mint reports missing access token', async () => {
  const state = parseFirebaseServiceAccountKey(validRaw(), 'runbee-prod')

  await assert.rejects(
    () => mintFirebaseAccessToken({
      getAccessToken: async () => ({}),
    }, state),
    (err) => {
      assert.equal(err.diagnosticCode, 'firebase_access_token_failed')
      assert.equal(err.httpStatus, 503)
      return true
    },
  )
})

test('Firebase credential mint reports missing credential state', async () => {
  const state = parseFirebaseServiceAccountKey(undefined, 'runbee-prod')

  await assert.rejects(
    () => mintFirebaseAccessToken(null, state),
    (err) => {
      assert.equal(err.diagnosticCode, 'firebase_service_account_missing')
      assert.equal(err.missingEnv, 'FIREBASE_SERVICE_ACCOUNT_KEY')
      return true
    },
  )
})

test('Firebase Auth diagnostic succeeds with config, token, and read-only lookup', async () => {
  const state = parseFirebaseServiceAccountKey(validRaw(), 'runbee-prod')
  const result = await runFirebaseAuthDiagnosticChecks({
    credentialState: state,
    mintAccessToken: async () => 'oauth-token',
    readOnlyAuthLookup: async () => {},
  })

  assert.deepEqual(result, {
    ok: true,
    config: 'ok',
    accessToken: 'ok',
    authLookup: 'ok',
  })
})

test('Firebase Auth diagnostic reports controlled config failure', async () => {
  const result = await runFirebaseAuthDiagnosticChecks({
    credentialState: parseFirebaseServiceAccountKey('bad-json', 'runbee-prod'),
    mintAccessToken: async () => 'oauth-token',
    readOnlyAuthLookup: async () => {},
  })

  assert.deepEqual(result, {
    ok: false,
    stage: 'config',
    diagnosticCode: 'firebase_service_account_invalid',
  })
})

test('Firebase Auth diagnostic reports controlled token failure without secrets', async () => {
  const state = parseFirebaseServiceAccountKey(validRaw(), 'runbee-prod')
  const result = await runFirebaseAuthDiagnosticChecks({
    credentialState: state,
    mintAccessToken: async () => {
      const error = new Error('secret token should not leak')
      error.diagnosticCode = 'firebase_access_token_failed'
      throw error
    },
    readOnlyAuthLookup: async () => {},
  })
  const payload = JSON.stringify(result)

  assert.deepEqual(result, {
    ok: false,
    stage: 'access_token',
    diagnosticCode: 'firebase_access_token_failed',
  })
  assert.equal(payload.includes('secret token'), false)
  assert.equal(payload.includes(validServiceAccount.private_key), false)
  assert.equal(payload.includes(validServiceAccount.client_email), false)
})

test('Firebase Auth diagnostic endpoint is admin-only, GET, and read-only', () => {
  const routeSource = readFileSync(new URL('../app/api/admin/diagnostics/firebase-auth/route.ts', import.meta.url), 'utf8')

  assert.equal(routeSource.includes('export async function GET'), true)
  assert.equal(routeSource.includes('requireAdminRequest'), true)
  assert.equal(routeSource.includes('runFirebaseAuthReadOnlyDiagnostic'), true)
  assert.equal(routeSource.includes('generateEmailVerificationLink'), false)
  assert.equal(routeSource.includes('sendEmailVerificationEmail'), false)
  assert.equal(routeSource.includes('createUser'), false)
  assert.equal(routeSource.includes('deleteUser'), false)
  assert.equal(routeSource.includes('access_token'), false)
  assert.equal(routeSource.includes('private_key'), false)
  assert.equal(routeSource.includes('client_email'), false)
})
