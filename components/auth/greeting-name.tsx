'use client'

import { useAuth } from '@/lib/auth-context'

/** Renders the logged-in user's first name inline, e.g. "Witaj ponownie, <GreetingName />". */
export function GreetingName() {
  const { user } = useAuth()
  return <>{user?.firstName ?? ''}</>
}
