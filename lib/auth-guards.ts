import type { AuthUser } from '@/lib/types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export function needsEmailVerificationGate(requireEmailVerification: boolean, status: AuthStatus, user: AuthUser | null): boolean {
  return requireEmailVerification && status === 'authenticated' && Boolean(user) && user?.emailVerified === false
}
