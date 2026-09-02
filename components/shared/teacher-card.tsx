import Link from 'next/link'
import { Star, MapPin, BadgeCheck, CalendarDays } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Teacher } from '@/lib/types'
import { cn } from '@/lib/utils'

const DAY_LABELS: Record<string, string> = {
  Mon: 'Pon', Tue: 'Wt', Wed: 'Śr', Thu: 'Czw', Fri: 'Pt', Sat: 'Sob', Sun: 'Nd',
}

interface TeacherCardProps {
  teacher: Teacher
  className?: string
  featured?: boolean
  /** Carried through from the marketplace when a parent is browsing to book for a linked student — appended to the profile link so the whole flow (profile → booking) stays scoped to that student. */
  bookingFor?: { id: string; name: string }
}

/**
 * One teacher, sized for a decision rather than for completeness.
 *
 * The previous card stacked six blocks — avatar row, two-line bio, a row
 * of skill pills plus an overflow pill, a metadata row, then a bordered
 * footer bar with the price and a button. Skills were the visually
 * loudest element despite being the least decisive, and the whole card
 * was a link target that still contained its own separate link, so the
 * price and CTA needed their own tinted footer to feel reachable.
 *
 * Here the entire card is one anchor. Rating and price — the two things
 * people actually compare — sit on the top line where they can be
 * scanned down a column, the bio carries the human voice, and skills
 * drop to a single quiet line of text. Availability is surfaced because
 * "can they teach when I'm free?" is a real filter on this data;
 * `verified` and `featured` are the only status markers, both real
 * fields.
 */
export function TeacherCard({ teacher, className, featured, bookingFor }: TeacherCardProps) {
  const profileHref = bookingFor
    ? `/teacher/${teacher.id}?bookingForId=${bookingFor.id}&bookingForName=${encodeURIComponent(bookingFor.name)}`
    : `/teacher/${teacher.id}`

  const availableDays = teacher.availability.map((d) => DAY_LABELS[d] ?? d)

  return (
    <Link
      href={profileHref}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        featured ? 'border-primary/40 hover:border-primary/60' : 'border-border hover:border-primary/40',
        className,
      )}
    >
      {/* Identity + the two comparison values */}
      <div className="flex items-start gap-3">
        <Avatar className="h-11 w-11 shrink-0">
          <AvatarFallback color={teacher.avatarColor}>{teacher.initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-foreground">{teacher.name}</h3>
            {teacher.verified && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Zweryfikowany nauczyciel" />
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{teacher.specialty}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 shrink-0 fill-primary stroke-none" aria-hidden="true" />
              <span className="font-semibold text-foreground">{teacher.rating.toFixed(1)}</span>
              <span>({teacher.reviewCount})</span>
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{teacher.location}</span>
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="whitespace-nowrap text-base font-bold leading-none text-foreground">{teacher.hourlyRate} zł</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">za godzinę</p>
        </div>
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{teacher.shortBio}</p>

      {/* Skills as text, not a wall of pills. */}
      <p className="truncate text-[11px] text-muted-foreground">
        <span className="text-foreground/70">{teacher.skills.slice(0, 3).join(' · ')}</span>
        {teacher.skills.length > 3 && <span> +{teacher.skills.length - 3}</span>}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{availableDays.join(', ')}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-primary transition-transform group-hover:translate-x-0.5">
          {teacher.experience} lat doświadczenia →
        </span>
      </div>

      {featured && (
        <span className="absolute -top-2 left-4 rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
          Wyróżniony
        </span>
      )}
    </Link>
  )
}
