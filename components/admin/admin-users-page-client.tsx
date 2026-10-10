'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getAdminUsers, setAdminUserDisabled } from '@/services/admin.service'
import { AdminUsersTable } from '@/components/admin/admin-users-table'
import type { AdminUserRow } from '@/lib/types'

interface Props {
  initialUsers: AdminUserRow[]
}

export function AdminUsersPageClient({ initialUsers }: Props) {
  const { user } = useAuth()
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState(initialUsers.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    if (!user || user.role !== 'admin') return
    setLoading(true)
    setError(null)
    try {
      const fresh = await getAdminUsers()
      setUsers(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać użytkowników.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    let active = true
    if (!user || user.role !== 'admin') {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getAdminUsers()
      .then((fresh) => {
        if (active) setUsers(fresh)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać użytkowników.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  async function handleSetAccountDisabled(target: AdminUserRow, disabled: boolean) {
    setBusyUserId(target.id)
    setError(null)
    try {
      await setAdminUserDisabled(target.id, disabled)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić statusu konta.')
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <AdminUsersTable
      users={users}
      loading={loading}
      error={error}
      onRetry={loadUsers}
      currentAdminId={user?.id ?? null}
      busyUserId={busyUserId}
      onSetAccountDisabled={handleSetAccountDisabled}
    />
  )
}
