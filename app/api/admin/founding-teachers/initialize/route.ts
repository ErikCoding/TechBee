import { NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { initializeFoundingTeacherProgram } from '@/lib/founding-teacher-program'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as { idToken?: string; confirm?: boolean })
  const admin = await requireAdminRequest(body.idToken, 'programem Pierwsza 50')
  if (admin instanceof NextResponse) return admin
  return NextResponse.json(await initializeFoundingTeacherProgram(admin.uid, Boolean(body.confirm)))
}
