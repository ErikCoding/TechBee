import type { MetadataRoute } from 'next'
import { getTeachers } from '@/services/teachers.service'
import { absoluteUrl, publicSeoRoutes } from '@/lib/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const teachers = await getTeachers()

  const publicEntries = publicSeoRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const teacherEntries = teachers.map((teacher) => ({
    url: absoluteUrl(`/teacher/${teacher.id}`),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: teacher.featured ? 0.85 : 0.75,
  }))

  return [...publicEntries, ...teacherEntries]
}

