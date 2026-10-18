import { LESSON_BUFFER_MINUTES, minutesToTime, timeToMinutes } from './lesson-time'

/** Cover every touched quarter-hour, including starts that are not aligned to :00/:15. */
export function lessonSlotLockIds(teacherId: string, dateIso: string, time: string, duration: number): string[] {
  const start = timeToMinutes(time)
  if (start === null || !Number.isFinite(duration) || duration <= 0) return []
  const ids: string[] = []
  for (let minute = Math.floor(start / 15) * 15; minute < start + duration + LESSON_BUFFER_MINUTES; minute += 15) {
    ids.push(`${teacherId}__${dateIso}__${minutesToTime(minute).replace(':', '-')}`)
  }
  return ids
}
