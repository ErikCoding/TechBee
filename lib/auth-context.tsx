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

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
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

  useEffect(() => {
    // subscribeToAuthState is a live Firebase listener when configured,
    // or a one-shot localStorage read in mock mode — either way this
    // must run client-side after mount to avoid hydration mismatches.
    const unsubscribe = subscribeToAuthState((sessionUser) => {
      setUser(sessionUser)
      setStatus(sessionUser ? 'authenticated' : 'unauthenticated')
    })
    return unsubscribe
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const loggedIn = await loginUser(input)
    setUser(loggedIn)
    setStatus('authenticated')
    return loggedIn
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const created = await registerUser(input)
    setUser(created)
    setStatus('authenticated')
    return created
  }, [])

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const updated = await updateUserProfile(input)
    setUser(updated)
    setStatus('authenticated')
    return updated
  }, [])

  const resendVerification = useCallback(async () => {
    await resendEmailVerification()
  }, [])

  const refreshVerification = useCallback(async () => {
    const fresh = await refreshEmailVerification()
    setUser(fresh)
    setStatus(fresh ? 'authenticated' : 'unauthenticated')
    return fresh
  }, [])

  const logout = useCallback(async () => {
    await logoutUser()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  return (
    <AuthContext.Provider value={{ user, status, login, register, updateProfile, resendVerification, refreshVerification, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
