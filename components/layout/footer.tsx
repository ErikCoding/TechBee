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
    { label: 'Ucz na TechBee', href: '/teach' },
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
            <div className="mt-4 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className="h-4 w-4 fill-[#F4B400]" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="ml-1 text-xs text-muted-foreground">4.9 · 6200+ opinii</span>
            </div>
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
            © {new Date().getFullYear()} TechBee Technologie Sp. z o.o. Wszelkie prawa zastrzeżone.
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
