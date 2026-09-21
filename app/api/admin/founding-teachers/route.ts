import { NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import {
  getFoundingTeacherAdminDashboard,
  updateFoundingTeacherConfig,
} from '@/lib/founding-teacher-program'
import type { FoundingTeacherProgramConfig } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as { idToken?: string })
  const admin = await requireAdminRequest(body.idToken, 'programem Pierwsza 50')
  if (admin instanceof NextResponse) return admin
  return NextResponse.json(await getFoundingTeacherAdminDashboard())
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}) as { idToken?: string; config?: Partial<FoundingTeacherProgramConfig> })
  const admin = await requireAdminRequest(body.idToken, 'programem Pierwsza 50')
  if (admin instanceof NextResponse) return admin
  return NextResponse.json(await updateFoundingTeacherConfig(body.config ?? {}, admin.uid))
}
