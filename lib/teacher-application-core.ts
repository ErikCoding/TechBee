import { normalizeLessonDurations } from './lesson-durations'
import { normalizeOfferedLessonPackageSizes } from './lesson-packages-core'
import { resolveTeacherTrialLessonConfig } from './trial-lessons'
import { getTeacherCategoryIds, normalizeTeacherCategoryIds, normalizeTeacherCustomSubjects } from './teacher-categories'
import { normalizeTeachingLevels } from './teaching-levels'
import { DEFAULT_AVAILABILITY_HOURS, normalizeAvailability, normalizeIntervals } from './availability-core'
import type { Teacher, TeacherApplicationInput, TeacherProfileSnapshot } from './types'

export function validateTeacherApplicationInput(value: unknown): TeacherApplicationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Nieprawidłowe zgłoszenie.')
  const input = value as TeacherApplicationInput
  for (const field of ['categoryId', 'specialty', 'location', 'shortBio', 'bio'] as const) {
    if (typeof input[field] !== 'string' || !input[field].trim()) throw new Error('Uzupełnij wymagane pola ogłoszenia.')
  }
  for (const field of ['categoryIds', 'customSubjects', 'skills', 'languages', 'availability'] as const) {
    if (!Array.isArray(input[field]) || input[field].some((item) => typeof item !== 'string')) throw new Error('Nieprawidłowe dane ogłoszenia.')
  }
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 5 || !Number.isFinite(input.experience) || input.experience < 0) {
    throw new Error('Sprawdź stawkę i doświadczenie.')
  }
  if (!Array.isArray(input.lessonDurations) || !input.lessonDurations.length || input.lessonDurations.some((n) => ![30, 60, 120].includes(n))) {
    throw new Error('Wybierz poprawną długość lekcji.')
  }
  if (input.photoUrl != null && typeof input.photoUrl !== 'string') throw new Error('Nieprawidłowe zdjęcie.')
  const [fallback] = normalizeIntervals([{
    start: input.availabilityStart ?? DEFAULT_AVAILABILITY_HOURS.start,
    end: input.availabilityEnd ?? DEFAULT_AVAILABILITY_HOURS.end,
  }])
  const availabilityHours = normalizeAvailability(input)
  // The builder below explicitly selects editable fields; client metadata is never spread into Firestore.
  return { ...input, availabilityStart: fallback.start, availabilityEnd: fallback.end, availabilityHours }
}

function snapshotTeacherProfile(teacher: Teacher): TeacherProfileSnapshot {
  return {
    name: teacher.name,
    initials: teacher.initials,
    avatarColor: teacher.avatarColor,
    ...(teacher.photoUrl ? { photoUrl: teacher.photoUrl } : {}),
    specialty: teacher.specialty,
    categoryId: teacher.categoryId,
    categoryIds: getTeacherCategoryIds(teacher),
    customSubjects: normalizeTeacherCustomSubjects(teacher.customSubjects),
    teachingLevels: normalizeTeachingLevels(teacher.teachingLevels),
    hourlyRate: teacher.hourlyRate,
    location: teacher.location,
    experience: teacher.experience,
    bio: teacher.bio,
    shortBio: teacher.shortBio,
    skills: teacher.skills,
    languages: teacher.languages,
    lessonDurations: normalizeLessonDurations(teacher.lessonDurations),
    trialLessonEnabled: teacher.trialLessonEnabled === true,
    ...(teacher.trialLessonEnabled === true && teacher.trialLessonDuration ? { trialLessonDuration: teacher.trialLessonDuration } : {}),
    ...(teacher.trialLessonEnabled === true && teacher.trialLessonPriceGrosze ? { trialLessonPriceGrosze: teacher.trialLessonPriceGrosze } : {}),
    lessonPackageSizes: normalizeOfferedLessonPackageSizes(teacher.lessonPackageSizes),
    availability: teacher.availability,
    ...(teacher.availabilityStart ? { availabilityStart: teacher.availabilityStart } : {}),
    ...(teacher.availabilityEnd ? { availabilityEnd: teacher.availabilityEnd } : {}),
    ...(teacher.availabilityHours ? { availabilityHours: teacher.availabilityHours } : {}),
    featured: teacher.featured,
    responseTime: teacher.responseTime,
    completionRate: teacher.completionRate,
  }
}

export function buildTeacherFromApplication(
  input: TeacherApplicationInput,
  authUser: { id: string; name: string; initials: string; avatarColor: string; photoUrl?: string },
  existing?: Teacher,
): Teacher {
  const photoUrl = 'photoUrl' in input
    ? input.photoUrl?.trim()
    : authUser.photoUrl ?? existing?.photoUrl
  const previousProfile = existing?.previousProfile
    ?? (existing && (existing.status ?? 'approved') === 'approved' ? snapshotTeacherProfile(existing) : undefined)
  const selectedCategoryIds = normalizeTeacherCategoryIds(input.categoryId, input.categoryIds)
  const primaryCategoryId = selectedCategoryIds.includes(input.categoryId)
    ? input.categoryId
    : selectedCategoryIds[0] ?? input.categoryId
  const customSubjects = normalizeTeacherCustomSubjects(input.customSubjects)
  const teachingLevels = normalizeTeachingLevels(input.teachingLevels)
  const trialConfig = resolveTeacherTrialLessonConfig(input)
  const lessonPackageSizes = normalizeOfferedLessonPackageSizes(input.lessonPackageSizes)
  if (input.trialLessonEnabled === true && !trialConfig.enabled) {
    throw new Error('Lekcja próbna wymaga poprawnej długości i ceny.')
  }

  return {
    id: authUser.id,
    name: authUser.name,
    initials: authUser.initials,
    avatarColor: authUser.avatarColor,
    ...(photoUrl ? { photoUrl } : {}),
    specialty: input.specialty,
    categoryId: primaryCategoryId,
    categoryIds: selectedCategoryIds,
    customSubjects,
    teachingLevels,
    rating: existing?.rating ?? 0,
    reviewCount: existing?.reviewCount ?? 0,
    hourlyRate: input.hourlyRate,
    location: input.location,
    experience: input.experience,
    students: existing?.students ?? 0,
    lessons: existing?.lessons ?? 0,
    bio: input.bio,
    shortBio: input.shortBio,
    skills: input.skills,
    languages: input.languages,
    lessonDurations: normalizeLessonDurations(input.lessonDurations),
    trialLessonEnabled: trialConfig.enabled,
    ...(trialConfig.enabled ? {
      trialLessonDuration: trialConfig.duration,
      trialLessonPriceGrosze: trialConfig.priceGrosze,
    } : {}),
    lessonPackageSizes,
    education: existing?.education ?? [],
    reviews: existing?.reviews ?? [],
    availability: input.availability,
    availabilityStart: input.availabilityStart,
    availabilityEnd: input.availabilityEnd,
    ...(input.availabilityHours ? { availabilityHours: normalizeAvailability(input) } : {}),
    verified: false,
    featured: existing?.featured ?? false,
    responseTime: existing?.responseTime ?? '< 24 godz.',
    completionRate: existing?.completionRate ?? 100,
    status: 'pending',
    authUserId: authUser.id,
    submittedAt: Date.now(),
    verificationKind: previousProfile ? 'profile_update' : 'new_profile',
    ...(previousProfile ? { previousProfile } : {}),
  }
}
