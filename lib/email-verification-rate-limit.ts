export const EMAIL_VERIFICATION_COOLDOWN_MS = 60_000
export const EMAIL_VERIFICATION_WINDOW_MS = 60 * 60 * 1000
export const EMAIL_VERIFICATION_MAX_ATTEMPTS_PER_WINDOW = 5

export type EmailVerificationRateLimitState = {
  attempts?: number[]
  lastSentAt?: number
}

export type EmailVerificationRateLimitDecision =
  | { allowed: true; nextAttempts: number[] }
  | { allowed: false; retryAfterSeconds: number; reason: 'cooldown' | 'hourly_limit' }

function retryAfterSeconds(untilMs: number, now: number): number {
  return Math.max(1, Math.ceil((untilMs - now) / 1000))
}

export function evaluateEmailVerificationRateLimit(
  state: EmailVerificationRateLimitState | null | undefined,
  now: number,
): EmailVerificationRateLimitDecision {
  const windowStart = now - EMAIL_VERIFICATION_WINDOW_MS
  const attempts = Array.isArray(state?.attempts)
    ? state.attempts.filter((value): value is number => Number.isFinite(value) && value > windowStart && value <= now)
    : []
  const lastSentAt = Number.isFinite(state?.lastSentAt) ? Number(state?.lastSentAt) : attempts.at(-1)

  if (lastSentAt && now - lastSentAt < EMAIL_VERIFICATION_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: retryAfterSeconds(lastSentAt + EMAIL_VERIFICATION_COOLDOWN_MS, now),
    }
  }

  if (attempts.length >= EMAIL_VERIFICATION_MAX_ATTEMPTS_PER_WINDOW) {
    const oldestAttempt = attempts[0]
    return {
      allowed: false,
      reason: 'hourly_limit',
      retryAfterSeconds: retryAfterSeconds(oldestAttempt + EMAIL_VERIFICATION_WINDOW_MS, now),
    }
  }

  return { allowed: true, nextAttempts: [...attempts, now] }
}
