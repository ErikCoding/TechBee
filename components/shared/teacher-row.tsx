import Link from 'next/link'
import { Star, MapPin, BadgeCheck, ArrowRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { foundingPromotionIsActive } from '@/lib/founding-teacher-core'
import { buildStudentPaymentBreakdown } from '@/lib/service-fees'
import { fromGrosze, toGrosze } from '@/lib/stripe-config'
import type { Teacher } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TeacherRowProps {
  teacher: Teacher
  className?: string
  featured?: boolean
  /** Same booking-for context as TeacherCard — keeps the profile → booking flow scoped to a linked student. */
  bookingFor?: { id: string; name: string }
}

/**
 * List entry with no box around it: rows are separated by a hairline (the
 * list wrapper draws it). Left to right: photo, the teacher's text (kept to
 * a readable line length), then a fixed-width column with the price and the
 * action, so prices and buttons line up down the whole list. On phones the
 * price + button move under the text.
 */
export function TeacherRow({ teacher, className, featured, bookingFor }: TeacherRowProps) {
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
        'group flex min-w-0 flex-col gap-4 rounded-xl px-3 py-5 transition-colors duration-200 sm:flex-row sm:items-center sm:gap-8 sm:px-5 sm:py-6',
        'hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center sm:gap-6">
        {/* Size set inline on purpose: it can never be overridden by utility classes. */}
        <Avatar className="shrink-0 rounded-full" style={{ width: 88, height: 88, minWidth: 88 }}>
          {teacher.photoUrl && <AvatarImage src={teacher.photoUrl} alt="" />}
          <AvatarFallback color={teacher.avatarColor} className="text-2xl">{teacher.initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 sm:max-w-2xl">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="break-words text-lg font-medium leading-snug text-foreground">{teacher.name}</h3>
            {teacher.verified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Zweryfikowany nauczyciel" />
            )}
            {featured && (
              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">Wyróżniony</span>
            )}
            {showFoundingBadge && (
              <span className="rounded bg-gradient-to-r from-emerald-600 to-teal-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Pierwsza 50
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{teacher.specialty}</p>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
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

          <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{teacher.shortBio}</p>
        </div>
      </div>

      {/* Price + action */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-border/60 pt-4 sm:w-56 sm:shrink-0 sm:flex-col sm:items-end sm:justify-center sm:gap-3 sm:border-t-0 sm:pt-0">
        <div className="sm:text-right">
          <p className="whitespace-nowrap text-foreground">
            <span className="text-xl font-semibold">{hourlyRateLabel} zł</span>
            <span className="ml-1 text-xs text-muted-foreground">/ 60 min</span>
          </p>
          <p className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground/80">
            łącznie {hourlyTotalLabel} zł z opłatą serwisową
          </p>
        </div>
        <span
          aria-hidden="true"
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground sm:ml-0"
        >
          Zobacz profil
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  )
}
