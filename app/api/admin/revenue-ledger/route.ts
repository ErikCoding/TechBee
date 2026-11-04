import { NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/admin-api-auth'
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin'
import { collections } from '@/lib/firebase'
import { operatorConfig } from '@/config/operator'
import {
  buildLedgerEntries, ledgerToCsv, quarterRangeFor, summarizeQuarter,
  type LedgerLessonRow, type LedgerPackageRow, type QuarterRange,
} from '@/lib/revenue-ledger-core'

export const runtime = 'nodejs'

function resolveQuarter(value: unknown, now: number): QuarterRange {
  const match = typeof value === 'string' ? /^(\d{4})-Q([1-4])$/.exec(value) : null
  if (!match) return quarterRangeFor(now)
  // Środek pierwszego miesiąca kwartału — bezpieczne wskazanie kwartału niezależnie od strefy.
  const year = Number(match[1])
  const month0 = (Number(match[2]) - 1) * 3
  return quarterRangeFor(Date.UTC(year, month0, 15, 12))
}

/** Admin-only: kwartalny licznik limitu działalności nierejestrowanej + eksport ewidencji sprzedaży (CSV). Tylko odczyt. */
export async function POST(request: Request) {
  if (!isAdminConfigured || !adminDb) {
    return NextResponse.json({ error: 'Zaufane zapisy Firestore nie są skonfigurowane.' }, { status: 503 })
  }
  const body = await request.json().catch(() => ({}) as { idToken?: string; quarter?: string; format?: string })
  const admin = await requireAdminRequest(body.idToken, 'ewidencją przychodu')
  if (admin instanceof NextResponse) return admin

  try {
    const [lessonsSnap, packagesSnap] = await Promise.all([
      adminDb.collection(collections.lessons).get(),
      adminDb.collection(collections.lessonPackages).get(),
    ])
    const lessons = lessonsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LedgerLessonRow)
    const packages = packagesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LedgerPackageRow)
    const entries = buildLedgerEntries(lessons, packages)
    const quarter = resolveQuarter(body.quarter, Date.now())
    const summary = summarizeQuarter(entries, quarter, operatorConfig.quarterlyRevenueLimitPln)
    const inQuarter = entries.filter((e) => e.date >= quarter.startMs && e.date < quarter.endMs)
    return NextResponse.json({
      summary,
      ...(body.format === 'csv' ? { csv: ledgerToCsv(inQuarter), filename: `runbee-ewidencja-${quarter.label.replace(' ', '-')}.csv` } : {}),
    })
  } catch (err) {
    console.error('[admin/revenue-ledger] Failed:', err)
    return NextResponse.json({ error: 'Nie udało się pobrać ewidencji przychodu.' }, { status: 500 })
  }
}
