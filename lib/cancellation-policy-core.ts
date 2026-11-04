// ─────────────────────────────────────────────────────────────
// Zasady odwołań i zmian terminu (szkic do weryfikacji przez prawnika):
//  • odwołanie przez ucznia/rodzica co najmniej 48 h przed lekcją →
//    automatyczne odwołanie i zwrot 100%, bez zgody korepetytora,
//  • odwołanie przez korepetytora (w dowolnym momencie przed lekcją) →
//    automatyczne odwołanie i zwrot 100%,
//  • odwołanie ucznia/rodzica później niż 48 h przed → prośba, którą
//    musi zaakceptować korepetytor (jak dotąd),
//  • przełożenie terminu możliwe najpóźniej 2 h przed lekcją
//    (druga strona nadal potwierdza nowy termin).
// ─────────────────────────────────────────────────────────────

export const FREE_CANCELLATION_HOURS = 48
export const RESCHEDULE_CUTOFF_HOURS = 2

const HOUR_MS = 60 * 60 * 1000

export type CancellationMode = 'immediate' | 'needs_approval'

export function cancellationMode(input: { requestedBy: 'student' | 'teacher'; startAtMs: number | null; now: number }): CancellationMode {
  if (input.requestedBy === 'teacher') return 'immediate'
  if (input.startAtMs === null) return 'needs_approval'
  return input.startAtMs - input.now >= FREE_CANCELLATION_HOURS * HOUR_MS ? 'immediate' : 'needs_approval'
}

export function canRequestReschedule(startAtMs: number | null, now: number): boolean {
  if (startAtMs === null) return false
  return startAtMs - now >= RESCHEDULE_CUTOFF_HOURS * HOUR_MS
}
