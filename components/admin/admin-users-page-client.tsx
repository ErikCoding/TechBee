'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getAdminUsers } from '@/services/admin.service'
import { AdminUsersTable } from '@/components/admin/admin-users-table'
import type { AdminUserRow } from '@/lib/types'

interface Props {
  initialUsers: AdminUserRow[]
}

export function AdminUsersPageClient({ initialUsers }: Props) {
  const { user } = useAuth()
  const [users, setUsers] = useState(initialUsers)

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    let cancelled = false
    getAdminUsers().then((fresh) => {
      if (!cancelled) setUsers(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  return <AdminUsersTable users={users} />
}
