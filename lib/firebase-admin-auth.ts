import 'server-only'

import { getAuth, type Auth } from 'firebase-admin/auth'
import { adminApp } from '@/lib/firebase-admin'

export const adminAuth: Auth | null = adminApp ? getAuth(adminApp) : null
export const isAdminAuthConfigured = Boolean(adminAuth)
