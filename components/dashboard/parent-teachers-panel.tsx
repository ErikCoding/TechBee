'use client'

import Link from 'next/link'
import { GraduationCap, MessageSquare, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel } from '@/components/dashboard/dashboard-primitives'
import type { Lesson } from '@/lib/types'

interface Props {
  /** Every lesson belonging to the selected child, any status. */
  lessons: Lesson[]
  childName: string
}

type TeacherSummary = {
  id: string
  name: string
  initials: string
  color: string
  specialty: string
  lessonCount: number
  completedCount: number
}

/**
 * Who actually teaches this child.
 *
 * A supervising parent's recurring question — "who are these people my
 * child is meeting online, and how much have they taught?" — had no
 * answer anywhere in the product. Teacher names appeared only as text
 * fragments inside individual lesson rows, so building that picture
 * meant reading every row and mentally de-duplicating.
 *
 * Derived entirely from the child's existing lesson list; no new query
 * and no new data. Each entry links to the teacher's public profile,
 * where the parent can read their qualifications and reviews.
 */
export function ParentTeachersPanel({ lessons, childName }: Props) {
  const byTeacher = new Map<string, TeacherSummary>()
  for (const lesson of lessons) {
    if (lesson.status === 'cancelled') continue
    const existing = byTeacher.get(lesson.teacherId)
    if (existing) {
      existing.lessonCount += 1
      if (lesson.status === 'completed') existing.completedCount += 1
    } else {
      byTeacher.set(lesson.teacherId, {
        id: lesson.teacherId,
        name: lesson.teacherName,
        initials: lesson.teacherInitials,
        color: lesson.teacherColor,
        specialty: lesson.specialty,
        lessonCount: 1,
        completedCount: lesson.status === 'completed' ? 1 : 0,
      })
    }
  }

  const teachers = [...byTeacher.values()].sort((a, b) => b.lessonCount - a.lessonCount)

  return (
    <Panel icon={GraduationCap} title="Nauczyciele dziecka" count={teachers.length}>
      {teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Brak nauczycieli"
          description={`${childName} nie miał(a) jeszcze lekcji.`}
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {teachers.map((teacher) => (
            <li key={teacher.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback color={teacher.color} className="text-[11px]">{teacher.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{teacher.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {teacher.specialty} · {teacher.completedCount} odbytych
                </p>
              </div>
              <Link
                href="/chat"
                aria-label={`Napisz do ${teacher.name}`}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link
                href={`/teacher/${teacher.id}`}
                aria-label={`Profil ${teacher.name}`}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
