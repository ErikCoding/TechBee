export type CheckoutSessionRaceDecision =
  | { action: 'create_lesson' }
  | { action: 'return_existing_lesson'; lessonId: string }
  | { action: 'slot_conflict' }
  | { action: 'same_session_in_progress' }

export type CheckoutSlotLockState = {
  exists: boolean
  checkoutSessionId?: unknown
  lessonId?: unknown
}

export function resolveCheckoutSessionRaceDecision({
  existingLessonId,
  currentCheckoutSessionId,
  slotLocks,
}: {
  existingLessonId?: string | null
  currentCheckoutSessionId: string
  slotLocks: CheckoutSlotLockState[]
}): CheckoutSessionRaceDecision {
  if (existingLessonId) return { action: 'return_existing_lesson', lessonId: existingLessonId }

  for (const lock of slotLocks) {
    if (!lock.exists) continue
    if (lock.checkoutSessionId === currentCheckoutSessionId) {
      return typeof lock.lessonId === 'string' && lock.lessonId.length > 0
        ? { action: 'return_existing_lesson', lessonId: lock.lessonId }
        : { action: 'same_session_in_progress' }
    }
    return { action: 'slot_conflict' }
  }

  return { action: 'create_lesson' }
}
