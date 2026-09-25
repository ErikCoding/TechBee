import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolveAuthSession } from '../lib/auth-session-core.ts'

const profile = {
  id: 'user-1',
  name: 'Anna Kowalska',
  firstName: 'Anna',
  email: 'anna@runbee.pl',
  role: 'teacher',
  initials: 'AK',
  avatarColor: '#F4B400',
}

test('auth session resolves a verified Firebase user with a valid profile', async () => {
  const result = await resolveAuthSession({
    firebaseUser: { uid: 'user-1', emailVerified: true },
    fetchProfile: async () => profile,
  })

  assert.equal(result.status, 'authenticated')
  assert.equal(result.user.emailVerified, true)
  assert.equal(result.user.id, 'user-1')
})

test('auth session resolves an unverified Firebase user without falling back to loading', async () => {
  const result = await resolveAuthSession({
    firebaseUser: { uid: 'user-1', emailVerified: false },
    fetchProfile: async () => profile,
  })

  assert.equal(result.status, 'authenticated')
  assert.equal(result.user.emailVerified, false)
})

test('auth session fails safe when the Firestore profile is missing', async () => {
  const result = await resolveAuthSession({
    firebaseUser: { uid: 'missing-user', emailVerified: true },
    fetchProfile: async () => null,
  })

  assert.equal(result.status, 'error')
  assert.equal(result.user, null)
  assert.equal(result.error.includes('profilu'), true)
})

test('auth session fails safe when Firestore profile fetch throws', async () => {
  const result = await resolveAuthSession({
    firebaseUser: { uid: 'user-1', emailVerified: true },
    fetchProfile: async () => {
      throw new Error('permission-denied')
    },
  })

  assert.equal(result.status, 'error')
  assert.equal(result.user, null)
  assert.equal(result.error.includes('pobrać'), true)
})

test('auth session fails safe when Firestore profile fetch does not resolve', async () => {
  const result = await resolveAuthSession({
    firebaseUser: { uid: 'user-1', emailVerified: true },
    fetchProfile: async () => new Promise(() => {}),
    profileTimeoutMs: 5,
  })

  assert.equal(result.status, 'error')
  assert.equal(result.user, null)
})

test('auth session resolves null Firebase user as unauthenticated', async () => {
  const result = await resolveAuthSession({
    firebaseUser: null,
    fetchProfile: async () => {
      throw new Error('should not be called')
    },
  })

  assert.equal(result.status, 'unauthenticated')
  assert.equal(result.user, null)
  assert.equal(result.error, null)
})

test('auth UI has a controlled error state instead of an infinite access loader', () => {
  const contextSource = readFileSync(new URL('../lib/auth-context.tsx', import.meta.url), 'utf8')
  const guardSource = readFileSync(new URL('../components/auth/require-auth.tsx', import.meta.url), 'utf8')

  assert.equal(contextSource.includes("setStatus(session.status)"), true)
  assert.equal(contextSource.includes("setStatus('error')"), true)
  assert.equal(guardSource.includes("status === 'error'"), true)
  assert.equal(guardSource.includes('Nie udało się sprawdzić dostępu do konta.'), true)
})

test('login verified return refreshes Firebase user state before redirecting', () => {
  const source = readFileSync(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')

  assert.equal(source.includes("searchParams.get('verified') === '1'"), true)
  assert.equal(source.includes('refreshVerification()'), true)
  assert.equal(source.includes('fresh?.emailVerified'), true)
  assert.equal(source.includes('router.replace(postLoginRedirect(fresh.role))'), true)
})
