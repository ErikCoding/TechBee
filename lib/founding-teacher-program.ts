import 'server-only'
import { type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import {
  calculateFoundingPromotionEndsAt,
  computeNextFoundingTeacherNumber,
  FOUNDING_TEACHER_CONFIG_DOC_ID,
  foundingTeacherSlotId,
  getFoundingPromotionStatus,
  normalizeFoundingTeacherConfig,
} from '@/lib/founding-teacher-core'
import { teacherIsPublicMarketplaceVisible } from '@/lib/teacher-visibility'
import type {
  FoundingTeacherAdminDashboard,
  FoundingTeacherAuditEntry,
  FoundingTeacherParticipantRow,
  FoundingTeacherPreviewRow,
  FoundingTeacherProgramConfig,
  FoundingTeacherPromotion,
  FoundingTeacherPublicProgram,
  Teacher,
} from '@/lib/types'

type TeacherProgramFields = Pick<Teacher, 'id' | 'name' | 'specialty' | 'hourlyRate' | 'status' | 'submittedAt' | 'categoryId' | 'categoryIds' | 'foundingTeacher' | 'foundingTeacherNumber' | 'foundingTeacherPromotion'> & {
  approvedAt?: number
  email?: string
}

function configRef() {
  return adminDb!.collection(collections.platformSettings).doc(FOUNDING_TEACHER_CONFIG_DOC_ID)
}

function nowLabel(ts: number) {
  return new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isEligibleTeacher(teacher: TeacherProgramFields | undefined): teacher is TeacherProgramFields {
  return Boolean(teacher && teacherIsPublicMarketplaceVisible(teacher) && !teacher.foundingTeacher && !teacher.foundingTeacherPromotion)
}

function sortEligibleTeachers(a: TeacherProgramFields, b: TeacherProgramFields) {
  const aTime = a.approvedAt ?? a.submittedAt ?? 0
  const bTime = b.approvedAt ?? b.submittedAt ?? 0
  if (aTime !== bTime) return aTime - bTime
  return (a.name ?? a.id).localeCompare(b.name ?? b.id, 'pl')
}

async function readConfig(): Promise<FoundingTeacherProgramConfig> {
  const snap = await configRef().get()
  return normalizeFoundingTeacherConfig(snap.exists ? snap.data() as Partial<FoundingTeacherProgramConfig> : null)
}

async function writeAudit(entry: Omit<FoundingTeacherAuditEntry, 'id'>) {
  await adminDb!.collection(collections.foundingTeacherAudit).add(entry)
}

function publicProgramFromConfig(config: FoundingTeacherProgramConfig): FoundingTeacherPublicProgram {
  const remaining = Math.max(0, config.limit - config.participantsCount)
  return {
    enabled: config.enabled,
    activeForPublic: config.enabled && remaining > 0,
    limit: config.limit,
    promoRate: config.promoRate,
    durationDays: config.durationDays,
    participantsCount: config.participantsCount,
    remaining,
    marketplaceHighlightEnabled: config.marketplaceHighlightEnabled,
    homepageBannerEnabled: config.homepageBannerEnabled,
    teachSectionEnabled: config.teachSectionEnabled,
  }
}

export async function getPublicFoundingTeacherProgram(): Promise<FoundingTeacherPublicProgram> {
  if (!adminDb) return publicProgramFromConfig(normalizeFoundingTeacherConfig(null))
  return publicProgramFromConfig(await readConfig())
}

async function getEligibleTeacherPreview(config: FoundingTeacherProgramConfig): Promise<FoundingTeacherPreviewRow[]> {
  const remaining = Math.max(0, config.limit - config.participantsCount)
  if (remaining <= 0) return []
  const snap = await adminDb!.collection(collections.teachers).where('status', '==', 'approved').get()
  return snap.docs
    .map((doc) => ({ ...(doc.data() as TeacherProgramFields), id: doc.id }))
    .filter(isEligibleTeacher)
    .sort(sortEligibleTeachers)
    .slice(0, remaining)
    .map((teacher) => ({
      teacherId: teacher.id,
      name: teacher.name ?? 'Bez nazwy',
      ...(teacher.specialty ? { specialty: teacher.specialty } : {}),
      ...(teacher.approvedAt ? { approvedAt: teacher.approvedAt } : {}),
      ...(teacher.submittedAt ? { submittedAt: teacher.submittedAt } : {}),
    }))
}

async function getParticipants(): Promise<FoundingTeacherParticipantRow[]> {
  const snap = await adminDb!.collection(collections.teachers).where('foundingTeacher', '==', true).get()
  const now = Date.now()
  const rows: FoundingTeacherParticipantRow[] = []
  for (const doc of snap.docs) {
    const teacher = { ...(doc.data() as TeacherProgramFields), id: doc.id }
    if (!teacher.foundingTeacherNumber || !teacher.foundingTeacherPromotion) continue
    rows.push({
      teacherId: teacher.id,
      name: teacher.name ?? 'Bez nazwy',
      ...(teacher.email ? { email: teacher.email } : {}),
      ...(teacher.specialty ? { specialty: teacher.specialty } : {}),
      ...(typeof teacher.hourlyRate === 'number' ? { hourlyRate: teacher.hourlyRate } : {}),
      foundingTeacherNumber: teacher.foundingTeacherNumber,
      promotion: teacher.foundingTeacherPromotion,
      status: getFoundingPromotionStatus(teacher.foundingTeacherPromotion, now),
      createdAt: teacher.foundingTeacherPromotion.assignedAt,
    })
  }
  return rows.sort((a, b) => a.foundingTeacherNumber - b.foundingTeacherNumber)
}

async function getAudit(): Promise<FoundingTeacherAuditEntry[]> {
  const snap = await adminDb!
    .collection(collections.foundingTeacherAudit)
    .orderBy('createdAt', 'desc')
    .limit(60)
    .get()
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FoundingTeacherAuditEntry, 'id'>) }))
}

export async function getFoundingTeacherAdminDashboard(): Promise<FoundingTeacherAdminDashboard> {
  const config = await readConfig()
  const [participants, preview, audit] = await Promise.all([
    getParticipants(),
    getEligibleTeacherPreview(config),
    getAudit(),
  ])
  return { config, participants, preview, audit }
}

export function applyFoundingTeacherAwardInTransaction(input: {
  tx: Transaction
  teacherRef: DocumentReference
  teacher: TeacherProgramFields
  config: FoundingTeacherProgramConfig
  adminId: string
  now: number
}): { number: number; promotion: FoundingTeacherPromotion; updates: Record<string, unknown> } | null {
  const nextNumber = computeNextFoundingTeacherNumber(input.config.participantsCount, input.config.limit)
  if (!input.config.enabled || !nextNumber || !isEligibleTeacher(input.teacher)) return null

  const promotion: FoundingTeacherPromotion = {
    type: 'founding_teacher',
    rate: input.config.promoRate,
    startedAt: input.now,
    endsAt: calculateFoundingPromotionEndsAt(input.now, input.config.durationDays),
    assignedAt: input.now,
    assignedBy: input.adminId,
    marketplaceHighlight: input.config.marketplaceHighlightEnabled,
  }
  const slotRef = adminDb!.collection(collections.foundingTeacherSlots).doc(foundingTeacherSlotId(nextNumber))
  input.tx.create(slotRef, {
    number: nextNumber,
    teacherId: input.teacher.id,
    teacherName: input.teacher.name ?? '',
    createdAt: input.now,
    createdBy: input.adminId,
  })
  const updates = {
    foundingTeacher: true,
    foundingTeacherNumber: nextNumber,
    foundingTeacherPromotion: promotion,
  }
  input.tx.update(input.teacherRef, updates)
  input.tx.set(configRef(), {
    ...input.config,
    participantsCount: nextNumber,
    updatedAt: input.now,
    updatedBy: input.adminId,
  }, { merge: true })
  return { number: nextNumber, promotion, updates }
}

export async function initializeFoundingTeacherProgram(adminId: string, confirm: boolean): Promise<FoundingTeacherAdminDashboard> {
  const config = await readConfig()
  const preview = await getEligibleTeacherPreview(config)
  if (!confirm) return { ...(await getFoundingTeacherAdminDashboard()), preview }

  const now = Date.now()
  const awarded: { teacherId: string; name: string; number: number; promotion: FoundingTeacherPromotion }[] = []
  await adminDb!.runTransaction(async (tx) => {
    const freshConfigSnap = await tx.get(configRef())
    const freshConfig = normalizeFoundingTeacherConfig(freshConfigSnap.exists ? freshConfigSnap.data() as Partial<FoundingTeacherProgramConfig> : config)
    const teacherRefs = preview.map((row) => adminDb!.collection(collections.teachers).doc(row.teacherId))
    const teacherSnaps = await Promise.all(teacherRefs.map((teacherRef) => tx.get(teacherRef)))
    let count = freshConfig.participantsCount
    const baseConfig = {
      ...freshConfig,
      enabled: true,
      initializedAt: freshConfig.initializedAt ?? now,
      initializedBy: freshConfig.initializedBy ?? adminId,
      updatedAt: now,
      updatedBy: adminId,
    }
    tx.set(configRef(), baseConfig, { merge: true })

    for (let i = 0; i < preview.length; i += 1) {
      const nextNumber = computeNextFoundingTeacherNumber(count, baseConfig.limit)
      if (!nextNumber) break
      const teacherRef = teacherRefs[i]
      const teacherSnap = teacherSnaps[i]
      const teacher = teacherSnap.exists ? ({ ...(teacherSnap.data() as TeacherProgramFields), id: teacherSnap.id }) : undefined
      if (!isEligibleTeacher(teacher)) continue
      const promotion: FoundingTeacherPromotion = {
        type: 'founding_teacher',
        rate: baseConfig.promoRate,
        startedAt: now,
        endsAt: calculateFoundingPromotionEndsAt(now, baseConfig.durationDays),
        assignedAt: now,
        assignedBy: adminId,
        marketplaceHighlight: baseConfig.marketplaceHighlightEnabled,
      }
      tx.create(adminDb!.collection(collections.foundingTeacherSlots).doc(foundingTeacherSlotId(nextNumber)), {
        number: nextNumber,
        teacherId: teacher.id,
        teacherName: teacher.name ?? '',
        createdAt: now,
        createdBy: adminId,
      })
      tx.update(teacherRef, {
        foundingTeacher: true,
        foundingTeacherNumber: nextNumber,
        foundingTeacherPromotion: promotion,
      })
      count = nextNumber
      awarded.push({ teacherId: teacher.id, name: teacher.name ?? 'Bez nazwy', number: nextNumber, promotion })
    }
    tx.set(configRef(), { participantsCount: count, updatedAt: now, updatedBy: adminId }, { merge: true })
  })

  await Promise.all([
    writeAudit({
      type: 'init',
      adminId,
      message: `Uruchomiono program i dodano ${awarded.length} nauczycieli.`,
      createdAt: now,
      after: { awardedCount: awarded.length, date: nowLabel(now) },
    }),
    ...awarded.map((item) => writeAudit({
      type: 'award',
      adminId,
      teacherId: item.teacherId,
      teacherName: item.name,
      message: `Nadano miejsce #${item.number} w programie Pierwsza 50.`,
      createdAt: now,
      after: { number: item.number, promotion: item.promotion },
    })),
  ])
  return getFoundingTeacherAdminDashboard()
}

export async function updateFoundingTeacherConfig(
  patch: Partial<FoundingTeacherProgramConfig>,
  adminId: string,
): Promise<FoundingTeacherAdminDashboard> {
  const now = Date.now()
  const before = await readConfig()
  const after = normalizeFoundingTeacherConfig({ ...before, ...patch, updatedAt: now, updatedBy: adminId })
  after.participantsCount = before.participantsCount
  if (after.limit < before.participantsCount) after.limit = before.participantsCount
  await configRef().set(after, { merge: true })
  await writeAudit({
    type: 'config_change',
    adminId,
    message: 'Zmieniono konfigurację programu Pierwsza 50.',
    createdAt: now,
    before,
    after,
  })
  return getFoundingTeacherAdminDashboard()
}

export async function updateFoundingTeacherPromotion(
  teacherId: string,
  patch: { rate?: number; endsAt?: number; marketplaceHighlight?: boolean },
  adminId: string,
): Promise<FoundingTeacherAdminDashboard> {
  const now = Date.now()
  const ref = adminDb!.collection(collections.teachers).doc(teacherId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Nie znaleziono nauczyciela.')
  const teacher = { ...(snap.data() as TeacherProgramFields), id: snap.id }
  if (!teacher.foundingTeacherPromotion) throw new Error('Ten nauczyciel nie ma promocji Pierwsza 50.')
  const before = teacher.foundingTeacherPromotion
  const after: FoundingTeacherPromotion = {
    ...before,
    ...(typeof patch.rate === 'number' ? { rate: Math.min(50, Math.max(0, patch.rate)) } : {}),
    ...(typeof patch.endsAt === 'number' ? { endsAt: patch.endsAt } : {}),
    ...(typeof patch.marketplaceHighlight === 'boolean' ? { marketplaceHighlight: patch.marketplaceHighlight } : {}),
  }
  await ref.update({ foundingTeacherPromotion: after, foundingTeacher: true })
  await writeAudit({
    type: 'manual_edit',
    adminId,
    teacherId,
    teacherName: teacher.name ?? 'Bez nazwy',
    message: 'Ręcznie zmieniono promocję nauczyciela.',
    createdAt: now,
    before,
    after,
  })
  return getFoundingTeacherAdminDashboard()
}

export async function recordFoundingTeacherAwardAudit(input: {
  adminId: string
  teacherId: string
  teacherName: string
  number: number
  promotion: FoundingTeacherPromotion
}) {
  await writeAudit({
    type: 'award',
    adminId: input.adminId,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    message: `Nadano miejsce #${input.number} w programie Pierwsza 50.`,
    createdAt: input.promotion.assignedAt,
    after: { number: input.number, promotion: input.promotion },
  })
}
