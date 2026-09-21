import Link from 'next/link'
import { ArrowRight, Trophy } from 'lucide-react'
import type { FoundingTeacherPublicProgram } from '@/lib/types'

export function FoundingTeacherBanner({ program }: { program: FoundingTeacherPublicProgram }) {
  if (!program.activeForPublic || !program.homepageBannerEnabled) return null

  return (
    <div className="border-b border-primary/20 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="truncate font-medium">
            Pierwsza 50: promocyjna prowizja {program.promoRate}% przez {program.durationDays} dni dla pierwszych nauczycieli.
          </p>
        </div>
        <Link href="/teach" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline">
          Zostań nauczycielem
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
