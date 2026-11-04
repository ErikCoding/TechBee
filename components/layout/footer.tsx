import Link from 'next/link'
import { BeeLogo } from '@/components/shared/bee-logo'
import { CookieSettingsButton } from '@/components/layout/cookie-settings-button'
import { operatorConfig } from '@/config/operator'
import { subjectPages } from '@/lib/subject-pages'

const footerLinks: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Platforma',
    links: [
      { label: 'Giełda nauczycieli', href: '/marketplace' },
      { label: 'Jak to działa', href: '/#how-it-works' },
      { label: 'BeePoints', href: '/beepoints' },
    ],
  },
  {
    title: 'Korepetycje',
    links: subjectPages.map((page) => ({ label: page.linkLabel, href: `/korepetycje/${page.slug}` })),
  },
  {
    title: 'Dla nauczycieli',
    links: [
      { label: 'Ucz na Runbee', href: '/teach' },
      { label: 'Warunki dla nauczycieli', href: '/teacher-terms' },
    ],
  },
  {
    title: 'Zaufanie i bezpieczeństwo',
    links: [
      { label: 'Ochrona małoletnich', href: '/ochrona-maloletnich' },
      { label: 'Jak sortujemy i oceniamy', href: '/zasady-rankingu' },
      { label: 'Zgłoś problem', href: '/zglos-problem' },
    ],
  },
  {
    title: 'Firma',
    links: [
      { label: 'O nas', href: '/about' },
      { label: 'Kontakt', href: '/contact' },
    ],
  },
]

const legalLinks = [
  { label: 'Regulamin', href: '/terms' },
  { label: 'Polityka prywatności', href: '/privacy' },
  { label: 'Cookies', href: '/cookies' },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,3fr)]">
          {/* Brand + operator */}
          <div>
            <BeeLogo size="md" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Lekcje online z nauczycielami, których profile i dostępność sprawdzisz przed rezerwacją.
            </p>
            <address className="mt-6 max-w-xs text-xs not-italic leading-relaxed text-muted-foreground">
              <span className="block font-semibold text-foreground">Operator serwisu</span>
              <span className="block">{operatorConfig.name}</span>
              <span className="block">działalność nierejestrowana</span>
              <span className="block">{operatorConfig.correspondenceAddress}</span>
              <a href={`mailto:${operatorConfig.email}`} className="mt-1 inline-block underline underline-offset-2 transition-colors hover:text-foreground">
                {operatorConfig.email}
              </a>
            </address>
          </div>

          {/* Links */}
          <nav aria-label="Stopka" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 xl:grid-cols-5">
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">{group.title}</h3>
                <ul className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Runbee. Wszelkie prawa zastrzeżone.</p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-foreground">{link.label}</Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton className="transition-colors hover:text-foreground" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
