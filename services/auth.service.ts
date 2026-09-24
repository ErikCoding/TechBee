import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, collections, db, isFirebaseConfigured } from '@/lib/firebase'
import { requireEmailVerification } from '@/lib/email-verification'
import { syncParticipantProfile, toParticipant } from '@/services/chat.service'
import { syncTeacherPublicIdentity } from '@/services/teachers.service'
import { runPasswordChangeWithSecurityNotification } from '@/lib/account-security-core'
import { AccountSecurityRequestError, requestEmailChangeVerification, requestPasswordChangedNotification } from '@/lib/account-security-client'
import { requestEmailVerificationEmail } from '@/lib/email-verification-client'
import type { AuthUser, PublicUserRole, UserRole } from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// Authentication.
//
// When Firebase is configured (see lib/firebase.ts), this talks to
// real Firebase Auth + a `users/{uid}` Firestore profile doc.
// Until then, it falls back to a localStorage-backed mock so the
// app keeps working offline/without a project. `AuthProvider`
// (lib/auth-context.tsx) only ever calls the functions below, so
// nothing else in the app needs to know which mode is active.
// ─────────────────────────────────────────────────────────────

const USERS_KEY = 'techbee.auth.users'
const SESSION_KEY = 'techbee.auth.session'

type StoredUser = AuthUser & { password: string }

const AVATAR_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#0EA5E9', '#F59E0B', '#EC4899', '#14B8A6']

function avatarColorFor(seed: string) {
  const hash = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '??'
}

function isBrowser() {
  return typeof window !== 'undefined'
}

async function requestVerificationEmailCurrentUser(forceRefresh = false): Promise<void> {
  if (!auth?.currentUser) return
  const idToken = await auth.currentUser.getIdToken(forceRefresh)
  await requestEmailVerificationEmail(idToken)
}

async function syncProfileSnapshotsThroughServer(): Promise<boolean> {
  if (!isBrowser() || !auth?.currentUser) return false
  try {
    const idToken = await auth.currentUser.getIdToken()
    const res = await fetch('/api/profile/sync-public-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function syncProfileSnapshots(user: AuthUser): Promise<void> {
  if (isFirebaseConfigured && await syncProfileSnapshotsThroughServer()) return
  await Promise.allSettled([
    syncParticipantProfile(toParticipant(user)),
    syncTeacherPublicIdentity(user),
  ])
}

export interface RegisterInput {
  name: string
  email: string
  password: string
  role: PublicUserRole
}

export interface LoginInput {
  email: string
  password: string
}

export interface UpdateProfileInput {
  name: string
  photoUrl?: string
}

export type AuthProviderState = {
  hasPasswordProvider: boolean
  providerIds: string[]
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

export type RequestEmailChangeInput = {
  newEmail: string
  currentPassword?: string
}

/**
 * Demo credentials — only shown as quick-login buttons in mock mode
 * (see components/auth/login-form.tsx). The admin account is
 * intentionally left out of that list: it's seeded so the panel is
 * reachable while testing, but not surfaced anywhere in the UI.
 */
export const demoAccounts = [
  { email: 'filip.nowicki@example.com', password: 'demo1234', role: 'student' as UserRole, label: 'Konto ucznia (demo)' },
  { email: 'marek.kowalski@example.com', password: 'demo1234', role: 'teacher' as UserRole, label: 'Konto nauczyciela (demo)' },
]

const demoAdminAccount = { email: 'admin@runbee.pl', password: 'admin1234', role: 'admin' as UserRole }

/**
 * The admin demo address before the Runbee rename. Still accepted so an
 * admin account already seeded into localStorage (or muscle memory) keeps
 * working — the rebrand should not lock anyone out of their own sandbox.
 */
const legacyAdminEmail = 'admin@techbee.pl'

// ── Mock (localStorage) implementation ──────────────────────

function readUsers(): StoredUser[] {
  if (!isBrowser()) return []
  ensureSeedData()
  try {
    return JSON.parse(window.localStorage.getItem(USERS_KEY) ?? '[]') as StoredUser[]
  } catch {
    return []
  }
}

function writeUsers(users: StoredUser[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function toPublicUser(user: StoredUser): AuthUser {
  const { password: _password, ...publicUser } = user
  return { ...publicUser, emailVerified: true }
}

function ensureSeedData() {
  if (!isBrowser()) return
  if (window.localStorage.getItem(USERS_KEY)) return
  const seed: StoredUser[] = [
    {
      id: 'u3',
      name: 'Filip Nowicki',
      firstName: 'Filip',
      email: demoAccounts[0].email,
      role: 'student',
      initials: 'FN',
      avatarColor: '#8B5CF6',
      password: demoAccounts[0].password,
    },
    {
      id: 'u1',
      name: 'Marek Kowalski',
      firstName: 'Marek',
      email: demoAccounts[1].email,
      role: 'teacher',
      initials: 'MK',
      avatarColor: '#3B82F6',
      password: demoAccounts[1].password,
    },
    {
      id: 'admin-1',
      name: 'Administrator Runbee',
      firstName: 'Admin',
      email: demoAdminAccount.email,
      role: 'admin',
      initials: 'RB',
      avatarColor: '#F4B400',
      password: demoAdminAccount.password,
    },
  ]
  window.localStorage.setItem(USERS_KEY, JSON.stringify(seed))
}

async function registerMock(input: RegisterInput): Promise<AuthUser> {
  const users = readUsers()
  const email = input.email.trim().toLowerCase()
  if (users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error('Konto z tym adresem e-mail już istnieje.')
  }
  const newUser: StoredUser = {
    id: `u-${Date.now()}`,
    name: input.name.trim(),
    firstName: input.name.trim().split(/\s+/)[0] ?? input.name.trim(),
    email,
    role: input.role,
    initials: initialsFor(input.name),
    avatarColor: avatarColorFor(email),
    password: input.password,
  }
  writeUsers([...users, newUser])
  if (isBrowser()) window.localStorage.setItem(SESSION_KEY, newUser.id)
  return toPublicUser(newUser)
}

async function loginMock(input: LoginInput): Promise<AuthUser> {
  const users = readUsers()
  const raw = input.email.trim().toLowerCase()
  // The admin demo address moved with the Runbee rename; the old one still
  // resolves so a sandbox seeded before the rename keeps working.
  const email = raw === legacyAdminEmail ? demoAdminAccount.email : raw
  const user = users.find((u) => u.email.toLowerCase() === email)
  if (!user || user.password !== input.password) {
    throw new Error('Nieprawidłowy e-mail lub hasło.')
  }
  if (isBrowser()) window.localStorage.setItem(SESSION_KEY, user.id)
  return toPublicUser(user)
}

function getStoredSessionMock(): AuthUser | null {
  if (!isBrowser()) return null
  const id = window.localStorage.getItem(SESSION_KEY)
  if (!id) return null
  const user = readUsers().find((u) => u.id === id)
  return user ? toPublicUser(user) : null
}

async function updateUserProfileMock(input: UpdateProfileInput): Promise<AuthUser> {
  const current = getStoredSessionMock()
  if (!current) throw new Error('Musisz być zalogowany, aby edytować profil.')
  const users = readUsers()
  const name = input.name.trim()
  const nextUsers = users.map((u) => (
    u.id === current.id
      ? {
          ...u,
          name,
          firstName: name.split(/\s+/)[0] ?? name,
          initials: initialsFor(name),
          ...(input.photoUrl ? { photoUrl: input.photoUrl.trim() } : { photoUrl: undefined }),
        }
      : u
  ))
  writeUsers(nextUsers)
  const updated = nextUsers.find((u) => u.id === current.id)
  if (!updated) throw new Error('Nie znaleziono profilu użytkownika.')
  const publicUser = toPublicUser(updated)
  await syncProfileSnapshots(publicUser)
  return publicUser
}

async function changePasswordMock(input: ChangePasswordInput): Promise<void> {
  const current = getStoredSessionMock()
  if (!current) throw new Error('Musisz być zalogowany, aby zmienić hasło.')
  const users = readUsers()
  const user = users.find((u) => u.id === current.id)
  if (!user) throw new Error('Nie znaleziono profilu użytkownika.')
  if (user.password !== input.currentPassword) throw new Error('Obecne hasło jest nieprawidłowe.')
  writeUsers(users.map((u) => u.id === current.id ? { ...u, password: input.newPassword } : u))
}

async function requestEmailChangeMock(input: RequestEmailChangeInput): Promise<void> {
  const current = getStoredSessionMock()
  if (!current) throw new Error('Musisz być zalogowany, aby zmienić adres e-mail.')
  const users = readUsers()
  const user = users.find((u) => u.id === current.id)
  if (!user) throw new Error('Nie znaleziono profilu użytkownika.')
  if (input.currentPassword && user.password !== input.currentPassword) throw new Error('Obecne hasło jest nieprawidłowe.')
}

// ── Firebase implementation ──────────────────────────────────

async function fetchFirebaseProfile(uid: string): Promise<AuthUser | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, collections.users, uid))
  if (!snap.exists()) return null
  const data = snap.data() as Omit<AuthUser, 'id'>
  return { id: uid, ...data }
}

async function fetchFirebaseSessionUser(): Promise<AuthUser | null> {
  if (!auth?.currentUser) return null
  await reload(auth.currentUser).catch(() => {})
  const profile = await fetchFirebaseProfile(auth.currentUser.uid)
  return profile ? { ...profile, emailVerified: auth.currentUser.emailVerified } : null
}

async function registerFirebase(input: RegisterInput): Promise<AuthUser> {
  if (!auth || !db) throw new Error('Firebase nie jest skonfigurowane.')
  const email = input.email.trim().toLowerCase()
  const credential = await createUserWithEmailAndPassword(auth, email, input.password)
  const profile: Omit<AuthUser, 'id'> = {
    name: input.name.trim(),
    firstName: input.name.trim().split(/\s+/)[0] ?? input.name.trim(),
    email,
    role: input.role,
    initials: initialsFor(input.name),
    avatarColor: avatarColorFor(email),
  }
  await Promise.all([
    // `createdAt` isn't part of the public AuthUser shape (nothing in the
    // app needs it on the client user object) but it's written to the doc
    // so the admin panel can show real "joined" dates and weekly-signup
    // counts instead of static demo numbers.
    setDoc(doc(db, collections.users, credential.user.uid), { ...profile, createdAt: Date.now() }),
    updateFirebaseProfile(credential.user, { displayName: profile.name }),
  ])
  let verificationEmailSent: boolean | undefined
  if (requireEmailVerification) {
    try {
      await requestVerificationEmailCurrentUser(true)
      verificationEmailSent = true
    } catch {
      verificationEmailSent = false
    }
  }
  return { id: credential.user.uid, ...profile, emailVerified: credential.user.emailVerified, verificationEmailSent }
}

async function loginFirebase(input: LoginInput): Promise<AuthUser> {
  if (!auth) throw new Error('Firebase nie jest skonfigurowane.')
  const credential = await signInWithEmailAndPassword(auth, input.email.trim().toLowerCase(), input.password)
  const profile = await fetchFirebaseProfile(credential.user.uid)
  if (!profile) throw new Error('Nie znaleziono profilu użytkownika.')
  return { ...profile, emailVerified: credential.user.emailVerified }
}

async function updateUserProfileFirebase(input: UpdateProfileInput): Promise<AuthUser> {
  if (!auth?.currentUser || !db) throw new Error('Musisz być zalogowany, aby edytować profil.')
  const name = input.name.trim()
  const patch = {
    name,
    firstName: name.split(/\s+/)[0] ?? name,
    initials: initialsFor(name),
    ...(input.photoUrl ? { photoUrl: input.photoUrl.trim() } : { photoUrl: '' }),
  }
  await Promise.all([
    updateDoc(doc(db, collections.users, auth.currentUser.uid), patch),
    updateFirebaseProfile(auth.currentUser, {
      displayName: patch.name,
      photoURL: patch.photoUrl && patch.photoUrl.length <= 1024 ? patch.photoUrl : null,
    }),
  ])
  const fresh = await fetchFirebaseProfile(auth.currentUser.uid)
  if (!fresh) throw new Error('Nie znaleziono profilu użytkownika.')
  const publicUser = { ...fresh, emailVerified: auth.currentUser.emailVerified }
  await syncProfileSnapshots(publicUser)
  return publicUser
}

function firebaseProviderState(): AuthProviderState {
  const providerIds = auth?.currentUser?.providerData.map((provider) => provider.providerId) ?? []
  return {
    hasPasswordProvider: providerIds.includes('password'),
    providerIds,
  }
}

async function reauthenticatePasswordUser(currentPassword: string): Promise<void> {
  if (!auth?.currentUser?.email) {
    throw new Error('Musisz być zalogowany, aby wykonać tę operację.')
  }
  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword)
  try {
    await reauthenticateWithCredential(auth.currentUser, credential)
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      throw new Error('Obecne hasło jest nieprawidłowe.')
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Zbyt wiele prób. Spróbuj ponownie za chwilę.')
    }
    throw new Error('Nie udało się potwierdzić tożsamości. Spróbuj ponownie.')
  }
}

async function changePasswordFirebase(input: ChangePasswordInput): Promise<void> {
  if (!auth?.currentUser) throw new Error('Musisz być zalogowany, aby zmienić hasło.')
  if (!firebaseProviderState().hasPasswordProvider) {
    throw new Error('To konto nie używa hasła Runbee. Zmień hasło u dostawcy logowania.')
  }
  await reauthenticatePasswordUser(input.currentPassword)
  try {
    const currentUser = auth.currentUser
    await runPasswordChangeWithSecurityNotification({
      changePassword: () => updatePassword(currentUser, input.newPassword),
      getIdToken: () => currentUser.getIdToken(true),
      notifyPasswordChanged: requestPasswordChangedNotification,
    })
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
    if (code === 'auth/weak-password') throw new Error('Nowe hasło jest zbyt słabe.')
    if (code === 'auth/requires-recent-login') throw new Error('Ze względów bezpieczeństwa zaloguj się ponownie i spróbuj jeszcze raz.')
    throw new Error('Nie udało się zmienić hasła.')
  }
}

async function requestEmailChangeFirebase(input: RequestEmailChangeInput): Promise<void> {
  if (!auth?.currentUser) throw new Error('Musisz być zalogowany, aby zmienić adres e-mail.')
  const providers = firebaseProviderState()
  if (providers.hasPasswordProvider) {
    if (!input.currentPassword) throw new Error('Podaj obecne hasło.')
    await reauthenticatePasswordUser(input.currentPassword)
  } else {
    throw new Error('Dla kont logowanych przez zewnętrznego dostawcę zmiana adresu e-mail wymaga ponownego logowania u tego dostawcy.')
  }

  const idToken = await auth.currentUser.getIdToken(true)
  try {
    await requestEmailChangeVerification(idToken, input.newEmail)
  } catch (error) {
    if (error instanceof AccountSecurityRequestError && error.code === 'requires-recent-login') {
      throw new Error('Ze względów bezpieczeństwa zaloguj się ponownie i spróbuj jeszcze raz.')
    }
    throw error
  }
}

// ── Public API ────────────────────────────────────────────────

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  return isFirebaseConfigured ? registerFirebase(input) : registerMock(input)
}

export async function loginUser(input: LoginInput): Promise<AuthUser> {
  return isFirebaseConfigured ? loginFirebase(input) : loginMock(input)
}

export async function logoutUser(): Promise<void> {
  if (isFirebaseConfigured && auth) {
    await signOut(auth)
    return
  }
  if (isBrowser()) window.localStorage.removeItem(SESSION_KEY)
}

export async function updateUserProfile(input: UpdateProfileInput): Promise<AuthUser> {
  return isFirebaseConfigured ? updateUserProfileFirebase(input) : updateUserProfileMock(input)
}

export function getCurrentAuthProviderState(): AuthProviderState {
  if (isFirebaseConfigured) return firebaseProviderState()
  return { hasPasswordProvider: true, providerIds: ['password'] }
}

export async function changeCurrentUserPassword(input: ChangePasswordInput): Promise<void> {
  return isFirebaseConfigured ? changePasswordFirebase(input) : changePasswordMock(input)
}

export async function requestCurrentUserEmailChange(input: RequestEmailChangeInput): Promise<void> {
  return isFirebaseConfigured ? requestEmailChangeFirebase(input) : requestEmailChangeMock(input)
}

export async function resendEmailVerification(): Promise<void> {
  if (!isFirebaseConfigured || !auth?.currentUser) return
  await requestVerificationEmailCurrentUser(true)
}

export async function refreshEmailVerification(): Promise<AuthUser | null> {
  if (!isFirebaseConfigured) return getStoredSessionMock()
  return fetchFirebaseSessionUser()
}

/** Looks up any user's public profile by id — used by services/family-link.service.ts to show a linked parent/student's name+avatar without duplicating the auth storage logic here. */
export async function getUserProfileById(userId: string): Promise<AuthUser | null> {
  if (isFirebaseConfigured) return fetchFirebaseProfile(userId)
  const user = readUsers().find((u) => u.id === userId)
  return user ? toPublicUser(user) : null
}

/**
 * Subscribes to auth state. In Firebase mode this is a live listener
 * (`onAuthStateChanged`); in mock mode it reads localStorage once and
 * calls back immediately. Always returns an unsubscribe function.
 */
export function subscribeToAuthState(callback: (user: AuthUser | null) => void): () => void {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        callback(null)
        return
      }
      const profile = await fetchFirebaseProfile(firebaseUser.uid)
      callback(profile ? { ...profile, emailVerified: firebaseUser.emailVerified } : null)
    })
  }
  callback(getStoredSessionMock())
  return () => {}
}
