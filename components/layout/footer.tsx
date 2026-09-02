import Link from 'next/link'
import { BeeLogo } from '@/components/shared/bee-logo'

const footerLinks = {
  Platforma: [
    { label: 'Giełda nauczycieli', href: '/marketplace' },
    { label: 'Jak to działa', href: '/#how-it-works' },
    { label: 'Wiadomości', href: '/chat' },
    { label: 'BeePoints', href: '/beepoints' },
  ],
  Specjalizacje: [
    { label: 'Programowanie PLC', href: '/marketplace?category=plc' },
    { label: 'Obróbka CNC', href: '/marketplace?category=cnc' },
    { label: 'Projektowanie CAD', href: '/marketplace?category=cad' },
    { label: 'Robotyka przemysłowa', href: '/marketplace?category=robotics' },
  ],
  Firma: [
    { label: 'O nas', href: '/about' },
    { label: 'Kontakt', href: '/contact' },
  ],
  'Dla nauczycieli': [
    { label: 'Ucz na Runbee', href: '/teach' },
    { label: 'Panel nauczyciela', href: '/dashboard/teacher' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <BeeLogo size="md" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Połącz się z certyfikowanymi specjalistami technicznymi na praktyczne lekcje online.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">{group}</h3>
              <ul className="flex flex-col gap-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Runbee Technologie Sp. z o.o. Wszelkie prawa zastrzeżone.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Prywatność</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Regulamin</Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
