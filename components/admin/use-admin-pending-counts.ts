'use client'

import { useEffect, useState } from 'react'
import { getOpenDisputes } from '@/services/lessons.service'
import { getPendingTeacherApplications } from '@/services/teachers.service'
import { listAdminSupportMessages } from '@/services/support.service'
import { listAdminAccountDeletionRequests } from '@/services/admin.service'
import { useAuth } from '@/lib/auth-context'

export type AdminPendingCounts = {
  verifications: number
  disputes: number
  support: number
  accountDeletion: number
}

export function useAdminPendingCounts(): AdminPendingCounts | null {
  const { user } = useAuth()
  const [counts, setCounts] = useState<AdminPendingCounts | null>(null)

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    let cancelled = false
    Promise.all([
      getPendingTeacherApplications().catch(() => []),
      getOpenDisputes().catch(() => []),
      listAdminSupportMessages().catch(() => ({ messages: [], unreadCount: 0 })),
      listAdminAccountDeletionRequests().catch(() => ({ requests: [] })),
    ]).then(([applications, disputes, support, deletion]) => {
      if (!cancelled) {
        setCounts({
          verifications: applications.length,
          disputes: disputes.length,
          support: support.unreadCount,
          accountDeletion: deletion.requests.filter((item) => item.status === 'pending_review' || item.status === 'needs_resolution').length,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  return counts
}
