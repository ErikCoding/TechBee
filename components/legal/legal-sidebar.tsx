'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const LEGAL_DOCUMENTS = [
  { href: '/terms', label: 'Regulamin' },
  { href: '/privacy', label: 'Polityka prywatności' },
  { href: '/cookies', label: 'Polityka cookies' },
  { href: '/teacher-terms', label: 'Warunki dla nauczycieli' },
  { href: '/ochrona-maloletnich', label: 'Ochrona małoletnich' },
  { href: '/zasady-rankingu', label: 'Zasady sortowania i opinii' },
] as const

const PL_MAP: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' }
function slugify(text: string): string {
  return text.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] ?? c).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

type Heading = { id: string; text: string }

/**
 * Boczna nawigacja dokumentów prawnych: lista dokumentów (z zaznaczonym bieżącym)
 * i spis treści bieżącej strony z podświetlaniem czytanej sekcji. Spis powstaje z nagłówków <h2>
 * w kontenerze #legal-content, więc działa dla każdego dokumentu bez ręcznej konfiguracji.
 */
export function LegalSidebar() {
  const pathname = usePathname()
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLHeadingElement>('#legal-content h2'))
    const used = new Set<string>()
    const list = nodes.map((node, i) => {
      let id = node.id || slugify(node.textContent ?? '') || `sekcja-${i + 1}`
      while (used.has(id)) id = `${id}-${i}`
      used.add(id)
      node.id = id
      node.style.scrollMarginTop = '96px'
      return { id, text: (node.textContent ?? '').trim() }
    })
    setHeadings(list)
    setActive(list[0]?.id ?? null)
    if (!nodes.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-90px 0px -65% 0px' },
    )
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [pathname])

  return (
    <>
      {/* Telefon: poziomy pasek dokumentów */}
      <nav aria-label="Dokumenty prawne" className="legal-docs-strip">
        {LEGAL_DOCUMENTS.map((doc) => (
          <Link key={doc.href} href={doc.href} aria-current={pathname === doc.href ? 'page' : undefined} className="legal-doc-pill">
            {doc.label}
          </Link>
        ))}
      </nav>

      {/* Komputer: lepki panel ze spisem treści (jak w serwisach z regulaminami) */}
      <aside className="legal-sidebar" aria-label="Nawigacja po dokumencie">
        {headings.length > 1 && (
          <nav aria-label="Spis treści">
            <p className="legal-sidebar-title">Spis treści</p>
            <ul>
              {headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} aria-current={active === h.id ? 'location' : undefined}>{h.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <nav aria-label="Dokumenty prawne">
          <p className="legal-sidebar-subtitle" style={headings.length > 1 ? undefined : { marginTop: 0, paddingTop: 0, borderTop: 'none' }}>Inne dokumenty</p>
          <ul>
            {LEGAL_DOCUMENTS.map((doc) => (
              <li key={doc.href}>
                <Link href={doc.href} aria-current={pathname === doc.href ? 'page' : undefined}>{doc.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
