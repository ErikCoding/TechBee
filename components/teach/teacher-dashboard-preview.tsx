import { CalendarDays, Inbox, ClipboardCheck, Wallet, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The single visual beside the `/teach` headline: the teacher panel, in
 * the panel vocabulary the panel itself uses — one `rounded-2xl`
 * bordered container, a `bg-muted/40` header bar, hairline-divided rows.
 *
 * It shows the four sections a teacher actually works in and what each
 * one is for. Deliberately no figures, names, dates or balances: those
 * would be invented data dressed up as a screenshot, and a prospective
 * teacher is not helped by seeing someone else's numbers. What they need
 * to know is that the work has a place to live, which is what a labelled
 * structure communicates honestly.
 */
const sections = [
  {
    icon: CalendarDays,
    title: 'Następna lekcja',
    detail: 'Kto, kiedy i o czym — z przyciskiem dołączenia do pokoju.',
  },
  {
    icon: Inbox,
    title: 'Prośby o rezerwację',
    detail: 'Każdy termin akceptujesz albo odrzucasz.',
  },
  {
    icon: ClipboardCheck,
    title: 'Raporty do wysłania',
    detail: 'Krótki raport po lekcji uruchamia rozliczenie.',
  },
  {
    icon: Wallet,
    title: 'Zarobki i wypłaty',
    detail: 'Saldo i historia transferów prosto ze Stripe.',
  },
]

export function TeacherDashboardPreview({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-card', className)}>
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3.5">
        <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">Panel nauczyciela</h2>
      </div>

      <ul className="divide-y divide-border">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <li
              key={section.title}
              className="group flex items-start gap-4 px-5 py-4 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary/5"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-[border-color,background-color,color,transform] duration-200 group-hover:scale-105 group-hover:border-primary/35 group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
                  {section.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
