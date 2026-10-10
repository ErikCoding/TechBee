import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildAdminUserRows, buildAdminUserRowsWithOptionalAuthLookup } from '../lib/admin-users-core.ts'

const profiles = [
  {
    id: 'verified-user',
    name: 'Zweryfikowana Osoba',
    email: 'old-verified@runbee.pl',
    role: 'teacher',
    initials: 'ZO',
    avatarColor: '#F4B400',
    createdAt: Date.parse('2026-09-01T10:00:00.000Z'),
  },
  {
    id: 'unverified-user',
    name: 'Niezweryfikowana Osoba',
    email: 'old-unverified@runbee.pl',
    role: 'student',
    initials: 'NO',
    avatarColor: '#3B82F6',
    createdAt: Date.parse('2026-09-02T10:00:00.000Z'),
  },
  {
    id: 'missing-auth-user',
    name: 'Brak Auth',
    email: 'firestore-only@runbee.pl',
    role: 'parent',
    initials: 'BA',
    avatarColor: '#10B981',
    createdAt: Date.parse('2026-08-30T10:00:00.000Z'),
  },
]

test('admin user rows read emailVerified=true from Firebase Auth', () => {
  const rows = buildAdminUserRows(profiles, [
    { uid: 'verified-user', email: 'verified@runbee.pl', emailVerified: true },
  ])
  const row = rows.find((item) => item.id === 'verified-user')

  assert.equal(row.emailVerified, true)
  assert.equal(row.email, 'verified@runbee.pl')
  assert.equal(row.role, 'teacher')
})

test('admin user rows read emailVerified=false from Firebase Auth', () => {
  const rows = buildAdminUserRows(profiles, [
    { uid: 'unverified-user', email: 'unverified@runbee.pl', emailVerified: false },
  ])
  const row = rows.find((item) => item.id === 'unverified-user')

  assert.equal(row.emailVerified, false)
  assert.equal(row.email, 'unverified@runbee.pl')
  assert.equal(row.role, 'student')
})

test('admin user rows do not invent verification state when Firebase Auth user is missing', () => {
  const rows = buildAdminUserRows(profiles, [])
  const row = rows.find((item) => item.id === 'missing-auth-user')

  assert.equal(row.emailVerified, null)
  assert.equal(row.email, 'firestore-only@runbee.pl')
  assert.equal(row.role, 'parent')
})

test('admin user rows expose real suspended status from Firebase Auth or Firestore profile', () => {
  const rows = buildAdminUserRows([
    profiles[0],
    { ...profiles[1], accountStatus: 'deactivated', deactivatedAt: 123, deactivatedBy: 'admin-1' },
  ], [
    { uid: 'verified-user', email: 'verified@runbee.pl', emailVerified: true, disabled: true },
    { uid: 'unverified-user', email: 'unverified@runbee.pl', emailVerified: false },
  ])

  const authDisabled = rows.find((item) => item.id === 'verified-user')
  const firestoreDisabled = rows.find((item) => item.id === 'unverified-user')

  assert.equal(authDisabled?.status, 'suspended')
  assert.equal(authDisabled?.disabled, true)
  assert.equal(firestoreDisabled?.status, 'suspended')
  assert.equal(firestoreDisabled?.accountStatus, 'deactivated')
  assert.equal(firestoreDisabled?.deactivatedAt, 123)
})

test('admin user rows preserve Firestore users when Firebase Auth lookup succeeds', async () => {
  const rows = await buildAdminUserRowsWithOptionalAuthLookup(profiles, async () => [
    { uid: 'verified-user', email: 'verified@runbee.pl', emailVerified: true },
    { uid: 'unverified-user', email: 'unverified@runbee.pl', emailVerified: false },
  ])

  assert.equal(rows.length, profiles.length)
  assert.equal(rows.find((item) => item.id === 'verified-user')?.emailVerified, true)
  assert.equal(rows.find((item) => item.id === 'unverified-user')?.emailVerified, false)
  assert.equal(rows.find((item) => item.id === 'missing-auth-user')?.emailVerified, null)
})

test('admin user rows preserve Firestore users when Firebase Auth lookup throws', async () => {
  const errors = []
  const rows = await buildAdminUserRowsWithOptionalAuthLookup(
    profiles,
    async () => {
      throw Object.assign(new Error('permission denied'), { code: 'auth/insufficient-permission' })
    },
    (err) => errors.push(err),
  )

  assert.equal(rows.length, profiles.length)
  assert.equal(errors.length, 1)
  assert.deepEqual(rows.map((item) => item.emailVerified), [null, null, null])
  assert.equal(rows.find((item) => item.id === 'verified-user')?.email, 'old-verified@runbee.pl')
})

test('admin user rows handle an empty Firestore list', async () => {
  const rows = await buildAdminUserRowsWithOptionalAuthLookup([], async () => [])
  assert.deepEqual(rows, [])
})

test('admin users route is admin-only and does not expose a public client path', () => {
  const routeSource = readFileSync(new URL('../app/api/admin/users/route.ts', import.meta.url), 'utf8')
  const serviceSource = readFileSync(new URL('../services/admin.service.ts', import.meta.url), 'utf8')
  const tableSource = readFileSync(new URL('../components/admin/admin-users-table.tsx', import.meta.url), 'utf8')
  const pageClientSource = readFileSync(new URL('../components/admin/admin-users-page-client.tsx', import.meta.url), 'utf8')
  const accountStatusRouteSource = readFileSync(new URL('../app/api/admin/users/[userId]/account-status/route.ts', import.meta.url), 'utf8')
  const adminApiAuthSource = readFileSync(new URL('../lib/admin-api-auth.ts', import.meta.url), 'utf8')

  assert.equal(routeSource.includes('requireAdminRequest'), true)
  assert.equal(routeSource.includes('auth.getUsers'), true)
  assert.equal(routeSource.includes('Failed to list Firestore users'), true)
  assert.equal(routeSource.includes('firebase_auth_lookup_failed'), true)
  assert.equal(routeSource.includes('buildAdminUserRows(profiles, [])'), true)
  assert.equal(serviceSource.includes("adminJson<{ users: AdminUserRow[] }>('/api/admin/users', 'POST')"), true)
  assert.equal(adminApiAuthSource.includes('status: 401'), true)
  assert.equal(adminApiAuthSource.includes('status: 403'), true)
  assert.equal(tableSource.includes('E-mail:'), true)
  assert.equal(tableSource.includes('Zweryfikowany'), true)
  assert.equal(tableSource.includes('Niezweryfikowany'), true)
  assert.equal(tableSource.includes('Nieznany'), true)
  assert.equal(tableSource.includes('Ładowanie użytkowników'), true)
  assert.equal(tableSource.includes('Brak użytkowników.'), true)
  assert.equal(tableSource.includes('Spróbuj ponownie'), true)
  assert.equal(pageClientSource.includes('.catch((err)'), true)
  assert.equal(pageClientSource.includes('setError'), true)
  assert.equal(accountStatusRouteSource.includes('requireAdminRequest'), true)
  assert.equal(accountStatusRouteSource.includes('updateUserDisabled'), true)
  assert.equal(accountStatusRouteSource.includes("profile.role === 'admin'"), true)
  assert.equal(tableSource.includes('Dezaktywuj'), true)
  assert.equal(tableSource.includes('Reaktywuj'), true)
})

test('admin Firebase Auth diagnostic endpoint requires admin authorization', () => {
  const routeSource = readFileSync(new URL('../app/api/admin/diagnostics/firebase-auth/route.ts', import.meta.url), 'utf8')

  assert.equal(routeSource.includes('export async function GET'), true)
  assert.equal(routeSource.includes('requireAdminRequest'), true)
  assert.equal(routeSource.includes('Bearer '), true)
  assert.equal(routeSource.includes('status: result.ok ? 200 : 503'), true)
})
