import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { UserRole } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Where each role lands after login/registration, and where "Panel"/back-button fallbacks should point. */
export function dashboardPathForRole(role: UserRole | undefined): string {
  if (role === 'teacher') return '/dashboard/teacher'
  if (role === 'admin') return '/admin'
  return '/dashboard/student'
}

/** Polish label for a role, used in account menus. */
export function roleLabelPl(role: UserRole | undefined): string {
  if (role === 'teacher') return 'Konto nauczyciela'
  if (role === 'admin') return 'Konto administratora'
  return 'Konto ucznia'
}

/**
 * Formats a timestamp relative to now, in Polish, for chat message/conversation
 * previews. Computed at render time (never stored) so it stays accurate as time
 * passes — the old approach stored a literal "teraz" string at send time, which
 * then never updated.
 */
export function formatChatTime(timestamp: number | undefined): string {
  if (!timestamp) return ''
  const diffMs = Date.now() - timestamp
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'teraz'
  if (diffMin < 60) return `${diffMin} min temu`

  const date = new Date(timestamp)
  const now = new Date()
  const hhmm = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })

  const isSameDay = date.toDateString() === now.toDateString()
  if (isSameDay) return hhmm

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `wczoraj, ${hhmm}`

  const sameYear = date.getFullYear() === now.getFullYear()
  const dateLabel = date.toLocaleDateString('pl-PL', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
  return `${dateLabel}, ${hhmm}`
}
