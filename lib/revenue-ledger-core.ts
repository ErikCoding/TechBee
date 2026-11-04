// ─────────────────────────────────────────────────────────────
// Ewidencja przychodu Runbee + licznik kwartalnego limitu działalności
// nierejestrowanej. Czysta logika (bez Firestore/Reacta), więc da się ją
// testować i później przepiąć na spółkę.
//
// DWIE WARTOŚCI (decyzja, co liczy się do limitu, należy do księgowego):
//  • przychód Runbee  = prowizja od korepetytora + opłata serwisowa ucznia
//  • obrót przez konto = cała kwota zapłacona przez ucznia (w tym część
//    korepetytora, która przechodzi przez konto Stripe Runbee)
//
// Liczymy wyłącznie płatności produkcyjne (livemode) i nie zwrócone.
// Datą zdarzenia jest data płatności (createdAt). Dla pakietów prowizja
// naliczana jest za wykorzystane lekcje (jak w panelu przychodów), a
// opłata serwisowa i obrót — w dniu zakupu.
// SZKIC księgowy — do weryfikacji przez księgowego.
// ─────────────────────────────────────────────────────────────

export const LIMIT_WARNING_THRESHOLDS = [0.8, 0.95] as const

export type LedgerLessonRow = {
  id?: string
  status?: string
  paymentStatus?: string
  paymentSource?: 'stripe_checkout' | 'package'
  lessonKind?: 'regular' | 'trial'
  studentServiceFeeGrosze?: number
  studentTotalGrosze?: number
  subtotalGrosze?: number
  priceGrosze?: number
  platformFeeGrosze?: number
  teacherAmountGrosze?: number
  stripeFeeGrosze?: number
  stripePaymentIntentId?: string
  withdrawalConsentAt?: number
  livemode?: boolean
  createdAt?: number
}

export type LedgerPackageRow = {
  id?: string
  status?: string
  packageSize?: number
  usedCredits?: number
  studentServiceFeeGrosze?: number
  studentTotalGrosze?: number
  subtotalGrosze?: number
  totalPriceGrosze?: number
  platformFeePerLessonGrosze?: number
  stripeFeeGrosze?: number
  stripePaymentIntentId?: string
  withdrawalConsentAt?: number
  livemode?: boolean
  createdAt?: number
}

export type LedgerEntry = {
  date: number
  kind: 'lesson' | 'trial_lesson' | 'package'
  documentId: string
  stripePaymentIntentId: string
  /** Cała kwota zapłacona przez ucznia (grosze). */
  turnoverGrosze: number
  /** Opłata serwisowa ucznia (grosze). */
  serviceFeeGrosze: number
  /** Prowizja od korepetytora (grosze). Dla pakietu: za wykorzystane lekcje. */
  commissionGrosze: number
  /** Część należna korepetytorowi z tej płatności (grosze, informacyjnie). */
  teacherShareGrosze: number
  /** Koszt Stripe, jeśli znany (grosze). */
  stripeFeeGrosze: number | null
  withdrawalConsentAt: number | null
}

export type QuarterRange = { year: number; quarter: 1 | 2 | 3 | 4; startMs: number; endMs: number; label: string }

const WARSAW = 'Europe/Warsaw'

function warsawParts(ms: number): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: WARSAW, year: 'numeric', month: 'numeric' }).formatToParts(new Date(ms))
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
  }
}

/** Północ 1. dnia miesiąca w strefie Europe/Warsaw (w ms UTC). */
function warsawMonthStartMs(year: number, monthIndex0: number): number {
  const guess = Date.UTC(year, monthIndex0, 1)
  // Offset Warszawy w tym momencie (godziny) — wyznaczony z Intl, bez zewnętrznych bibliotek.
  const offsetMin = (() => {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: WARSAW, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    const p = Object.fromEntries(f.formatToParts(new Date(guess)).map((x) => [x.type, x.value]))
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute))
    return Math.round((asUtc - guess) / 60000)
  })()
  return guess - offsetMin * 60000
}

export function quarterRangeFor(ms: number): QuarterRange {
  const { year, month } = warsawParts(ms)
  const quarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4
  const startMonth = (quarter - 1) * 3
  const startMs = warsawMonthStartMs(year, startMonth)
  const endMs = startMonth + 3 >= 12 ? warsawMonthStartMs(year + 1, 0) : warsawMonthStartMs(year, startMonth + 3)
  return { year, quarter, startMs, endMs, label: `${year} Q${quarter}` }
}

const n = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function buildLedgerEntries(lessons: LedgerLessonRow[], packages: LedgerPackageRow[]): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  for (const l of lessons) {
    // Lekcje z pakietu nie mają własnej płatności — wchodzą przez pakiet.
    if (l.paymentSource === 'package') continue
    if (l.paymentStatus !== 'paid' || l.livemode !== true || !l.createdAt) continue
    const subtotal = n(l.subtotalGrosze) || n(l.priceGrosze)
    const serviceFee = n(l.studentServiceFeeGrosze)
    entries.push({
      date: l.createdAt,
      kind: l.lessonKind === 'trial' ? 'trial_lesson' : 'lesson',
      documentId: l.id ?? '',
      stripePaymentIntentId: l.stripePaymentIntentId ?? '',
      turnoverGrosze: n(l.studentTotalGrosze) || subtotal + serviceFee,
      serviceFeeGrosze: serviceFee,
      commissionGrosze: n(l.platformFeeGrosze),
      teacherShareGrosze: n(l.teacherAmountGrosze),
      stripeFeeGrosze: Number.isFinite(l.stripeFeeGrosze) ? (l.stripeFeeGrosze as number) : null,
      withdrawalConsentAt: l.withdrawalConsentAt ?? null,
    })
  }
  for (const p of packages) {
    if (p.livemode !== true || !p.createdAt) continue
    if (p.status === 'refunded' || p.status === 'cancelled') continue
    const subtotal = n(p.subtotalGrosze) || n(p.totalPriceGrosze)
    const serviceFee = n(p.studentServiceFeeGrosze)
    const used = n(p.usedCredits)
    const perLessonFee = n(p.platformFeePerLessonGrosze)
    entries.push({
      date: p.createdAt,
      kind: 'package',
      documentId: p.id ?? '',
      stripePaymentIntentId: p.stripePaymentIntentId ?? '',
      turnoverGrosze: n(p.studentTotalGrosze) || subtotal + serviceFee,
      serviceFeeGrosze: serviceFee,
      commissionGrosze: used * perLessonFee,
      teacherShareGrosze: Math.max(0, subtotal - n(p.packageSize) * perLessonFee),
      stripeFeeGrosze: Number.isFinite(p.stripeFeeGrosze) ? (p.stripeFeeGrosze as number) : null,
      withdrawalConsentAt: p.withdrawalConsentAt ?? null,
    })
  }
  return entries.sort((a, b) => a.date - b.date)
}

export type QuarterSummary = {
  quarter: QuarterRange
  limitGrosze: number
  runbeeRevenueGrosze: number
  turnoverGrosze: number
  /** Ile % limitu zajmuje przychód Runbee / obrót (0–1+). */
  runbeeRevenueShare: number
  turnoverShare: number
  entryCount: number
  warning: 'none' | 'warning_80' | 'warning_95' | 'exceeded'
  turnoverWarning: 'none' | 'warning_80' | 'warning_95' | 'exceeded'
}

export function warningLevel(share: number): QuarterSummary['warning'] {
  if (share >= 1) return 'exceeded'
  if (share >= LIMIT_WARNING_THRESHOLDS[1]) return 'warning_95'
  if (share >= LIMIT_WARNING_THRESHOLDS[0]) return 'warning_80'
  return 'none'
}

export function summarizeQuarter(entries: LedgerEntry[], quarter: QuarterRange, limitPln: number): QuarterSummary {
  const inQuarter = entries.filter((e) => e.date >= quarter.startMs && e.date < quarter.endMs)
  const limitGrosze = Math.round(limitPln * 100)
  const runbeeRevenueGrosze = inQuarter.reduce((s, e) => s + e.serviceFeeGrosze + e.commissionGrosze, 0)
  const turnoverGrosze = inQuarter.reduce((s, e) => s + e.turnoverGrosze, 0)
  const runbeeRevenueShare = limitGrosze > 0 ? runbeeRevenueGrosze / limitGrosze : 0
  const turnoverShare = limitGrosze > 0 ? turnoverGrosze / limitGrosze : 0
  return {
    quarter, limitGrosze, runbeeRevenueGrosze, turnoverGrosze, runbeeRevenueShare, turnoverShare,
    entryCount: inQuarter.length,
    warning: warningLevel(runbeeRevenueShare),
    turnoverWarning: warningLevel(turnoverShare),
  }
}

// ── CSV ──────────────────────────────────────────────────────

/** Zabezpiecza komórkę przed wstrzyknięciem formuły w Excelu/Sheets i poprawnie cytuje. */
export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const plnText = (grosze: number) => (grosze / 100).toFixed(2).replace('.', ',')
const KIND_LABEL: Record<LedgerEntry['kind'], string> = { lesson: 'Lekcja', trial_lesson: 'Lekcja próbna', package: 'Pakiet' }

function warsawDateTime(ms: number): string {
  return new Intl.DateTimeFormat('pl-PL', { timeZone: WARSAW, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))
}

const CSV_HEADERS = [
  'Data płatności', 'Rodzaj', 'Id dokumentu', 'Stripe PaymentIntent', 'Obrót (zapłacone przez ucznia) PLN',
  'Opłata serwisowa PLN', 'Prowizja od korepetytora PLN', 'Przychód Runbee PLN', 'Część korepetytora PLN',
  'Koszt Stripe PLN', 'Zgoda na start usługi',
]

/** Średnik jako separator i BOM na początku — poprawnie otwiera się w polskim Excelu. */
export function ledgerToCsv(entries: LedgerEntry[]): string {
  const rows = entries.map((e) => [
    warsawDateTime(e.date), KIND_LABEL[e.kind], e.documentId, e.stripePaymentIntentId,
    plnText(e.turnoverGrosze), plnText(e.serviceFeeGrosze), plnText(e.commissionGrosze),
    plnText(e.serviceFeeGrosze + e.commissionGrosze), plnText(e.teacherShareGrosze),
    e.stripeFeeGrosze === null ? '' : plnText(e.stripeFeeGrosze),
    e.withdrawalConsentAt ? warsawDateTime(e.withdrawalConsentAt) : 'brak',
  ])
  const lines = [CSV_HEADERS, ...rows].map((r) => r.map((c) => csvCell(c)).join(';'))
  return `﻿${lines.join('\r\n')}\r\n`
}
