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
