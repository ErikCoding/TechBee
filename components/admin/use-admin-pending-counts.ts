'use client'

import { useEffect, useState } from 'react'
import { getOpenDisputes } from '@/services/lessons.service'
import { getPendingTeacherApplications } from '@/services/teachers.service'

export type AdminPendingCounts = {
  verifications: number
  disputes: number
}

export function useAdminPendingCounts(): AdminPendingCounts | null {
  const [counts, setCounts] = useState<AdminPendingCounts | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getPendingTeacherApplications().catch(() => []),
      getOpenDisputes().catch(() => []),
    ]).then(([applications, disputes]) => {
      if (!cancelled) setCounts({ verifications: applications.length, disputes: disputes.length })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return counts
}
