'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth-context'

export function AdminIdentity() {
  const { user, logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8" aria-hidden="true">
        {user?.photoUrl && <AvatarImage src={user.photoUrl} alt="" />}
        <AvatarFallback color={user?.avatarColor ?? '#F4B400'} className="text-xs">
          {user?.initials ?? 'TB'}
        </AvatarFallback>
      </Avatar>
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Wyloguj
      </button>
    </div>
  )
}
