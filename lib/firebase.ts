// ─────────────────────────────────────────────────────────────
// Firebase client bootstrap.
//
// Reads config from NEXT_PUBLIC_FIREBASE_* env vars (see .env.example).
// If they aren't set, `isFirebaseConfigured` is false and every
// `services/*.service.ts` function falls back to local mock data —
// the app keeps working even before Firebase is wired up, and
// switches over automatically the moment real env vars are present.
// No other file needs to change when that happens.
// ─────────────────────────────────────────────────────────────

import { type FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'
import { type Firestore, getFirestore } from 'firebase/firestore'
import { type FirebaseStorage, getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** True once real Firebase project credentials are present. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null
let storageInstance: FirebaseStorage | null = null

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  authInstance = getAuth(app)
  dbInstance = getFirestore(app)
  storageInstance = getStorage(app)
}

export const firebaseApp = app
export const auth = authInstance
export const db = dbInstance
export const storage = storageInstance

/** Firestore collection names — single source of truth so services agree on them. */
export const collections = {
  users: 'users',
  teachers: 'teachers',
  categories: 'categories',
  testimonials: 'testimonials',
  faq: 'faq',
  lessons: 'lessons',
  wallets: 'wallets',
  walletTransactions: 'walletTransactions',
  beepoints: 'beepoints',
  beepointsEvents: 'beepointsEvents',
  notifications: 'notifications',
  conversations: 'conversations',
  messages: 'messages',
  reviews: 'reviews',
  linkCodes: 'linkCodes',
} as const
