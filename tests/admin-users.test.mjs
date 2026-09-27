import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildAdminUserRows } from '../lib/admin-users-core.ts'

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

test('admin users route is admin-only and does not expose a public client path', () => {
  const routeSource = readFileSync(new URL('../app/api/admin/users/route.ts', import.meta.url), 'utf8')
  const serviceSource = readFileSync(new URL('../services/admin.service.ts', import.meta.url), 'utf8')
  const tableSource = readFileSync(new URL('../components/admin/admin-users-table.tsx', import.meta.url), 'utf8')

  assert.equal(routeSource.includes('requireAdminRequest'), true)
  assert.equal(routeSource.includes('auth.getUsers'), true)
  assert.equal(serviceSource.includes("adminJson<{ users: AdminUserRow[] }>('/api/admin/users', 'POST')"), true)
  assert.equal(tableSource.includes('E-mail:'), true)
  assert.equal(tableSource.includes('Zweryfikowany'), true)
  assert.equal(tableSource.includes('Niezweryfikowany'), true)
})
