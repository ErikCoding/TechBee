import { NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { buildAdminStatsFromRows } from '@/lib/admin-stats-core'
import { computeAdminPlatformRevenue, type AdminRevenueLessonPackageRow, type AdminRevenueLessonRow } from '@/lib/admin-revenue-metrics'
import type { Teacher } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}) as { idToken?: string })
  const admin = await requireAdminRequest(body.idToken, 'statystykami administratora')
  if (admin instanceof NextResponse) return admin

  try {
    const [usersSnap, teachersSnap, lessonsSnap, packagesSnap] = await Promise.all([
      adminDb.collection(collections.users).get(),
      adminDb.collection(collections.teachers).get(),
      adminDb.collection(collections.lessons).get(),
      adminDb.collection(collections.lessonPackages).get(),
    ])

    const lessons = lessonsSnap.docs.map((doc) => doc.data() as AdminRevenueLessonRow)
    const packages = packagesSnap.docs.map((doc) => doc.data() as AdminRevenueLessonPackageRow)
    const stats = buildAdminStatsFromRows({
      users: usersSnap.docs.map((doc) => doc.data()),
      teachers: teachersSnap.docs.map((doc) => doc.data() as Teacher),
      revenue: computeAdminPlatformRevenue(lessons, new Date(), packages),
    })

    return NextResponse.json({ stats })
  } catch (err) {
    console.error('[admin/stats] Failed to build admin stats:', err)
    return NextResponse.json({ error: 'Nie udało się pobrać statystyk administratora.' }, { status: 500 })
  }
}
