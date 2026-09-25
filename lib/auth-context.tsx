'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  loginUser,
  logoutUser,
  refreshEmailVerification,
  registerUser,
  resendEmailVerification,
  subscribeToAuthState,
  updateUserProfile,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from '@/services/auth.service'
import type { AuthUser } from '@/lib/types'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  error: string | null
  login: (input: LoginInput) => Promise<AuthUser>
  register: (input: RegisterInput) => Promise<AuthUser>
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser>
  resendVerification: () => Promise<void>
  refreshVerification: () => Promise<AuthUser | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // subscribeToAuthState is a live Firebase listener when configured,
    // or a one-shot localStorage read in mock mode — either way this
    // must run client-side after mount to avoid hydration mismatches.
    const unsubscribe = subscribeToAuthState((session) => {
      setUser(session.user)
      setStatus(session.status)
      setError(session.error)
    })
    return unsubscribe
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const loggedIn = await loginUser(input)
    setUser(loggedIn)
    setStatus('authenticated')
    setError(null)
    return loggedIn
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const created = await registerUser(input)
    setUser(created)
    setStatus('authenticated')
    setError(null)
    return created
  }, [])

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const updated = await updateUserProfile(input)
    setUser(updated)
    setStatus('authenticated')
    setError(null)
    return updated
  }, [])

  const resendVerification = useCallback(async () => {
    await resendEmailVerification()
  }, [])

  const refreshVerification = useCallback(async () => {
    try {
      const fresh = await refreshEmailVerification()
      setUser(fresh)
      setStatus(fresh ? 'authenticated' : 'unauthenticated')
      setError(null)
      return fresh
    } catch (err) {
      setUser(null)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Nie udało się odświeżyć sesji.')
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutUser()
    setUser(null)
    setStatus('unauthenticated')
    setError(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, status, error, login, register, updateProfile, resendVerification, refreshVerification, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
