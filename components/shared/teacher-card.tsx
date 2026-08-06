import Link from 'next/link'
import { Star, MapPin, Clock, BadgeCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Teacher } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TeacherCardProps {
  teacher: Teacher
  className?: string
  featured?: boolean
}

export function TeacherCard({ teacher, className, featured }: TeacherCardProps) {
  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[#F4B400]/30',
        featured && 'ring-1 ring-[#F4B400]/40',
        className,
      )}
    >
      {/* Featured strip — a top bar instead of a floating badge, so it never covers card text */}
      {featured && <div className="h-1 w-full shrink-0 bg-[#F4B400]" aria-hidden="true" />}

      <div className="p-5">
        {/* Avatar + info */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: teacher.avatarColor }}
            aria-hidden="true"
          >
            {teacher.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate font-semibold text-foreground">{teacher.name}</h3>
              {teacher.verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-[#F4B400]" aria-label="Zweryfikowany nauczyciel" />
              )}
              {featured && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F4B400] px-2 py-0.5 text-[10px] font-semibold text-[#0A0A0A]">
                  <Star className="h-2.5 w-2.5 fill-[#0A0A0A]" />
                  Wyróżniony
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{teacher.specialty}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {teacher.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                {teacher.responseTime}
              </span>
            </div>
          </div>
        </div>

        {/* Bio */}
        <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {teacher.shortBio}
        </p>

        {/* Skills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {teacher.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-[11px] font-normal">
              {skill}
            </Badge>
          ))}
          {teacher.skills.length > 3 && (
            <Badge variant="secondary" className="text-[11px] font-normal">
              +{teacher.skills.length - 3}
            </Badge>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Rating */}
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 shrink-0 fill-[#F4B400] stroke-none" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">{teacher.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({teacher.reviewCount})</span>
          </div>
          {/* Stats */}
          <span className="text-xs text-muted-foreground">
            {teacher.lessons.toLocaleString('pl-PL')} lekcji
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm font-bold text-foreground">
            {teacher.hourlyRate} zł
            <span className="text-xs font-normal text-muted-foreground">/godz.</span>
          </span>
          <Link href={`/teacher/${teacher.id}`}>
            <Button
              size="sm"
              className="h-8 bg-[#F4B400] text-[#0A0A0A] hover:bg-[#FBBF24] font-semibold text-xs"
            >
              Zobacz profil
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}
