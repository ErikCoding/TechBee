export const TEACHER_MIN_PAYOUT_GROSZE = 10_000
export const TEACHER_MIN_PAYOUT_LABEL = '100 zł'
export const TEACHER_MIN_PAYOUT_ERROR = `Minimalna kwota wypłaty wynosi ${TEACHER_MIN_PAYOUT_LABEL}.`
export const TEACHER_PAYOUT_IN_PROGRESS_ERROR = 'Wypłata jest już przetwarzana. Odśwież portfel za chwilę.'
export const TEACHER_PAYOUT_UNRESOLVED_ERROR = 'Poprzednia wypłata jest nadal weryfikowana. Spróbuj ponownie później.'
export const TEACHER_PAYOUT_LOCK_TTL_MS = 10 * 60 * 1000

export type TeacherPayoutValidationResult =
  | { ok: true }
  | { ok: false; status: 400 | 409; error: string; code: 'invalid_amount' | 'below_minimum' | 'insufficient_balance' | 'payout_in_progress' }

export type TeacherPayoutLockLike = {
  attemptId?: string
  amountGrosze?: number
  status?: string
  stripePayoutId?: string
  expiresAt?: number
}

export type TeacherPayoutAttemptDecision =
  | {
      ok: true
      attemptId: string
      status: 'processing'
      reused: boolean
      lock: {
        teacherId: string
        attemptId: string
        amountGrosze: number
        status: 'processing'
        startedAt?: number
        retryStartedAt?: number
        stripePayoutId?: string
        expiresAt: number
      }
    }
  | { ok: false; status: 409; error: string; code: 'payout_in_progress' | 'unresolved_attempt' }

export type TeacherStripePayoutsClient<TPayout = unknown> = {
  create: (
    params: { amount: number; currency: string },
    options: { stripeAccount: string; idempotencyKey: string },
  ) => Promise<TPayout>
}

export function validateTeacherPayoutAmount(amountGrosze: number, availableGrosze?: number): TeacherPayoutValidationResult {
  if (!Number.isFinite(amountGrosze) || amountGrosze <= 0) {
    return { ok: false, status: 400, error: 'Nieprawidłowa kwota.', code: 'invalid_amount' }
  }
  if (amountGrosze < TEACHER_MIN_PAYOUT_GROSZE) {
    return { ok: false, status: 400, error: TEACHER_MIN_PAYOUT_ERROR, code: 'below_minimum' }
  }
  if (typeof availableGrosze === 'number' && amountGrosze > availableGrosze) {
    return { ok: false, status: 400, error: 'Kwota przekracza dostępne saldo.', code: 'insufficient_balance' }
  }
  return { ok: true }
}

export function canStartTeacherPayoutAttempt(lock: TeacherPayoutLockLike | null | undefined, now = Date.now()): boolean {
  if (!lock || lock.status !== 'processing') return true
  return typeof lock.expiresAt === 'number' && lock.expiresAt <= now
}

export function beginTeacherPayoutAttempt(input: {
  existingLock?: TeacherPayoutLockLike | null
  teacherId: string
  amountGrosze: number
  now: number
  createAttemptId: () => string
}): TeacherPayoutAttemptDecision {
  const { existingLock, teacherId, amountGrosze, now, createAttemptId } = input
  const expiresAt = now + TEACHER_PAYOUT_LOCK_TTL_MS

  if (!existingLock || existingLock.status !== 'processing') {
    const attemptId = createAttemptId()
    return {
      ok: true,
      attemptId,
      status: 'processing',
      reused: false,
      lock: { teacherId, attemptId, amountGrosze, status: 'processing', startedAt: now, expiresAt },
    }
  }

  if (!canStartTeacherPayoutAttempt(existingLock, now)) {
    return { ok: false, status: 409, error: TEACHER_PAYOUT_IN_PROGRESS_ERROR, code: 'payout_in_progress' }
  }

  if (!existingLock.attemptId || typeof existingLock.amountGrosze !== 'number') {
    return { ok: false, status: 409, error: TEACHER_PAYOUT_UNRESOLVED_ERROR, code: 'unresolved_attempt' }
  }

  if (existingLock.amountGrosze !== amountGrosze) {
    return { ok: false, status: 409, error: TEACHER_PAYOUT_UNRESOLVED_ERROR, code: 'unresolved_attempt' }
  }

  return {
    ok: true,
    attemptId: existingLock.attemptId,
    status: 'processing',
    reused: true,
    lock: {
      teacherId,
      attemptId: existingLock.attemptId,
      amountGrosze,
      status: 'processing',
      retryStartedAt: now,
      ...(existingLock.stripePayoutId ? { stripePayoutId: existingLock.stripePayoutId } : {}),
      expiresAt,
    },
  }
}

export function teacherPayoutAttemptIdempotencyKey(attemptId: string): string {
  return `teacher-payout:${attemptId}`
}

export async function createTeacherStripePayout<TPayout>(
  payouts: TeacherStripePayoutsClient<TPayout>,
  input: { amountGrosze: number; currency: string; stripeAccount: string; attemptId: string },
): Promise<TPayout> {
  return payouts.create(
    { amount: input.amountGrosze, currency: input.currency },
    { stripeAccount: input.stripeAccount, idempotencyKey: teacherPayoutAttemptIdempotencyKey(input.attemptId) },
  )
}
