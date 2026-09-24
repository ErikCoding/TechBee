export const ACCOUNT_SECURITY_COOLDOWN_MS = 60_000
export const ACCOUNT_SECURITY_WINDOW_MS = 60 * 60 * 1000
export const ACCOUNT_SECURITY_MAX_ATTEMPTS_PER_WINDOW = 5

export type AccountSecurityRateLimitState = {
  attempts?: number[]
  lastSentAt?: number
}

export type AccountSecurityRateLimitDecision =
  | { allowed: true; nextAttempts: number[] }
  | { allowed: false; retryAfterSeconds: number; reason: 'cooldown' | 'hourly_limit' }

function retryAfterSeconds(untilMs: number, now: number): number {
  return Math.max(1, Math.ceil((untilMs - now) / 1000))
}

export function evaluateAccountSecurityRateLimit(
  state: AccountSecurityRateLimitState | null | undefined,
  now: number,
): AccountSecurityRateLimitDecision {
  const windowStart = now - ACCOUNT_SECURITY_WINDOW_MS
  const attempts = Array.isArray(state?.attempts)
    ? state.attempts.filter((value): value is number => Number.isFinite(value) && value > windowStart && value <= now)
    : []
  const lastSentAt = Number.isFinite(state?.lastSentAt) ? Number(state?.lastSentAt) : attempts.at(-1)

  if (lastSentAt && now - lastSentAt < ACCOUNT_SECURITY_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: retryAfterSeconds(lastSentAt + ACCOUNT_SECURITY_COOLDOWN_MS, now),
    }
  }

  if (attempts.length >= ACCOUNT_SECURITY_MAX_ATTEMPTS_PER_WINDOW) {
    const oldestAttempt = attempts[0]
    return {
      allowed: false,
      reason: 'hourly_limit',
      retryAfterSeconds: retryAfterSeconds(oldestAttempt + ACCOUNT_SECURITY_WINDOW_MS, now),
    }
  }

  return { allowed: true, nextAttempts: [...attempts, now] }
}
