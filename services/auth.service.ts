import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, collections, db, isFirebaseConfigured } from '@/lib/firebase'
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

const demoAdminAccount = { email: 'admin@techbee.pl', password: 'admin1234', role: 'admin' as UserRole }

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
  return publicUser
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
      name: 'Administrator TechBee',
      firstName: 'Admin',
      email: demoAdminAccount.email,
      role: 'admin',
      initials: 'TB',
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
  const email = input.email.trim().toLowerCase()
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

// ── Firebase implementation ──────────────────────────────────

async function fetchFirebaseProfile(uid: string): Promise<AuthUser | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, collections.users, uid))
  if (!snap.exists()) return null
  const data = snap.data() as Omit<AuthUser, 'id'>
  return { id: uid, ...data }
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
    updateProfile(credential.user, { displayName: profile.name }),
  ])
  return { id: credential.user.uid, ...profile }
}

async function loginFirebase(input: LoginInput): Promise<AuthUser> {
  if (!auth) throw new Error('Firebase nie jest skonfigurowane.')
  const credential = await signInWithEmailAndPassword(auth, input.email.trim().toLowerCase(), input.password)
  const profile = await fetchFirebaseProfile(credential.user.uid)
  if (!profile) throw new Error('Nie znaleziono profilu użytkownika.')
  return profile
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
      callback(profile)
    })
  }
  callback(getStoredSessionMock())
  return () => {}
}
