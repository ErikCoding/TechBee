import type { AuthUser } from '@/lib/types'

export type AuthSessionStatus = 'authenticated' | 'unauthenticated' | 'error'

export type FirebaseSessionUser = {
  uid: string
  emailVerified: boolean
}

export type AuthSessionResult =
  | { status: 'authenticated'; user: AuthUser; error: null }
  | { status: 'unauthenticated'; user: null; error: null }
  | { status: 'error'; user: null; error: string }

export const AUTH_PROFILE_LOAD_TIMEOUT_MS = 12_000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('auth-profile-timeout')), timeoutMs)
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
  })
}

export async function resolveAuthSession(input: {
  firebaseUser: FirebaseSessionUser | null
  fetchProfile: (uid: string) => Promise<AuthUser | null>
  profileTimeoutMs?: number
}): Promise<AuthSessionResult> {
  if (!input.firebaseUser) {
    return { status: 'unauthenticated', user: null, error: null }
  }

  try {
    const profile = await withTimeout(
      input.fetchProfile(input.firebaseUser.uid),
      input.profileTimeoutMs ?? AUTH_PROFILE_LOAD_TIMEOUT_MS,
    )
    if (!profile) {
      return {
        status: 'error',
        user: null,
        error: 'Nie znaleziono profilu użytkownika.',
      }
    }

    return {
      status: 'authenticated',
      user: { ...profile, emailVerified: input.firebaseUser.emailVerified },
      error: null,
    }
  } catch {
    return {
      status: 'error',
      user: null,
      error: 'Nie udało się pobrać profilu użytkownika.',
    }
  }
}
