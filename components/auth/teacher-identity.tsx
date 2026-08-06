'use client'

import { useAuth } from '@/lib/auth-context'

interface TeacherIdentityProps {
  fallbackName: string
  fallbackInitials: string
  fallbackAvatarColor: string
}

/**
 * Shows the logged-in teacher's real name/initials/avatar color instead of
 * the shared demo dataset's — the rest of the dashboard's numbers still
 * come from the single mock teacher dataset (see services/lessons.service.ts).
 */
export function TeacherIdentity({ fallbackName, fallbackInitials, fallbackAvatarColor }: TeacherIdentityProps) {
  const { user } = useAuth()
  const name = user?.role === 'teacher' ? user.name : fallbackName
  const initials = user?.role === 'teacher' ? user.initials : fallbackInitials
  const avatarColor = user?.role === 'teacher' ? user.avatarColor : fallbackAvatarColor

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white"
        style={{ backgroundColor: avatarColor }}
        aria-hidden="true"
      >
        {initials}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Panel nauczyciela</p>
        <h1 className="text-xl font-bold text-foreground">{name}</h1>
      </div>
    </div>
  )
}
