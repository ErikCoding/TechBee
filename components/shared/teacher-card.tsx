import Link from 'next/link'
import { Star, MapPin, BadgeCheck, ArrowRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { foundingPromotionIsActive } from '@/lib/founding-teacher-core'
import { buildStudentPaymentBreakdown } from '@/lib/service-fees'
import { fromGrosze, toGrosze } from '@/lib/stripe-config'
import type { Teacher } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TeacherCardProps {
  teacher: Teacher
  className?: string
  featured?: boolean
  /** Carried through from the marketplace when a parent is browsing to book for a linked student — appended to the profile link so the whole flow (profile → booking) stays scoped to that student. */
  bookingFor?: { id: string; name: string }
}

/**
 * One teacher, as light as possible: a large photo, the name and what they
 * teach, one quiet line for rating and place, two lines of their own words,
 * and the price. No dividers, no chips, no buttons — the card is a soft
 * outline that fills in on hover, and the whole thing is one link.
 */
export function TeacherCard({ teacher, className, featured, bookingFor }: TeacherCardProps) {
  const profileHref = bookingFor
    ? `/teacher/${teacher.id}?bookingForId=${bookingFor.id}&bookingForName=${encodeURIComponent(bookingFor.name)}`
    : `/teacher/${teacher.id}`

  const showFoundingBadge = foundingPromotionIsActive(teacher.foundingTeacherPromotion) && teacher.foundingTeacherPromotion.marketplaceHighlight !== false
  const hourlyRateLabel = teacher.hourlyRate.toLocaleString('pl-PL')
  const hourlyPayment = buildStudentPaymentBreakdown(toGrosze(teacher.hourlyRate))
  const hourlyTotalLabel = fromGrosze(hourlyPayment.studentTotalGrosze).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const hasReviews = teacher.reviewCount > 0 && teacher.rating > 0

  return (
    <Link
      href={profileHref}
      className={cn(
        'group relative flex min-w-0 flex-col gap-4 rounded-2xl border p-5 transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        featured
          ? 'border-primary/30 bg-card/40 hover:border-primary/50 hover:bg-card'
          : 'border-border/60 bg-card/40 hover:border-border hover:bg-card',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {/* Size set inline on purpose: it can never be overridden by utility classes. */}
        <Avatar className="shrink-0 rounded-full" style={{ width: 96, height: 96, minWidth: 96 }}>
          {teacher.photoUrl && <AvatarImage src={teacher.photoUrl} alt="" />}
          <AvatarFallback color={teacher.avatarColor} className="text-3xl">{teacher.initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className="line-clamp-2 break-words text-base font-medium leading-snug text-foreground">{teacher.name}</h3>
            {teacher.verified && (
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Zweryfikowany nauczyciel" />
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{teacher.specialty}</p>

          <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            {hasReviews ? (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 shrink-0 fill-primary stroke-none" aria-hidden="true" />
                <span className="font-medium text-foreground">{teacher.rating.toFixed(1)}</span>
                <span>({teacher.reviewCount})</span>
              </span>
            ) : (
              <span>Nowy</span>
            )}
            {teacher.location && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{teacher.location}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{teacher.shortBio}</p>

      {/* Wraps instead of overlapping: when price + fee note + button don't fit on one line, the button drops to its own row. */}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <p className="whitespace-nowrap text-foreground">
            <span className="text-lg font-semibold">{hourlyRateLabel} zł</span>
            <span className="ml-1 text-xs text-muted-foreground">/ 60 min</span>
          </p>
          <p className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground/80">
            łącznie {hourlyTotalLabel} zł z opłatą serwisową
          </p>
        </div>
        {/* The whole card is the link; this is its visible call to action. */}
        <span
          aria-hidden="true"
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors duration-200 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
        >
          Zobacz profil
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>

      {(featured || showFoundingBadge) && (
        <div className="absolute left-4 top-0 flex -translate-y-1/2 flex-wrap gap-1.5">
          {featured && (
            <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">Wyróżniony</span>
          )}
          {showFoundingBadge && (
            <span className="rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              Pierwsza 50
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
