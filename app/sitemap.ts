import type { MetadataRoute } from 'next'
import { getPublicTeachersForSitemap } from '@/services/seo-teachers.service'
import { subjectPages } from '@/lib/subject-pages'
import { absoluteUrl, publicSeoRoutes } from '@/lib/seo'
import type { Teacher } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TeacherWithPossibleUpdateDate = Teacher & {
  updatedAt?: Date | number | string | { toDate?: () => Date }
}

function reliableDate(value: TeacherWithPossibleUpdateDate['updatedAt']): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate()
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  return undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const teachers = await getPublicTeachersForSitemap()

  const publicEntries = publicSeoRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const teacherEntries = teachers
    .filter((teacher) => teacher.id)
    .map((teacher) => {
      const lastModified = reliableDate((teacher as TeacherWithPossibleUpdateDate).updatedAt)
      return {
        url: absoluteUrl(`/teacher/${teacher.id}`),
        ...(lastModified ? { lastModified } : {}),
        changeFrequency: 'weekly' as const,
        priority: teacher.featured ? 0.85 : 0.75,
      }
    })

  const subjectEntries = subjectPages.map((page) => ({
    url: absoluteUrl(`/korepetycje/${page.slug}`),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...publicEntries, ...subjectEntries, ...teacherEntries]
}
