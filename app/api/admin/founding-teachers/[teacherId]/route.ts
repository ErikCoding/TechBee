import { NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { updateFoundingTeacherPromotion } from '@/lib/founding-teacher-program'

export const runtime = 'nodejs'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teacherId: string }> },
) {
  const body = await request.json().catch(() => ({}) as { idToken?: string; rate?: number; endsAt?: number; marketplaceHighlight?: boolean })
  const admin = await requireAdminRequest(body.idToken, 'programem Pierwsza 50')
  if (admin instanceof NextResponse) return admin
  const { teacherId } = await params
  try {
    return NextResponse.json(await updateFoundingTeacherPromotion(teacherId, {
      ...(typeof body.rate === 'number' ? { rate: body.rate } : {}),
      ...(typeof body.endsAt === 'number' ? { endsAt: body.endsAt } : {}),
      ...(typeof body.marketplaceHighlight === 'boolean' ? { marketplaceHighlight: body.marketplaceHighlight } : {}),
    }, admin.uid))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Nie udało się zapisać promocji.' }, { status: 400 })
  }
}
