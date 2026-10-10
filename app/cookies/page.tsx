import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Polityka cookies',
  description: 'Informacje o plikach cookies, pamięci przeglądarki i statystykach używanych w serwisie Runbee.',
  path: '/cookies',
})

const link = 'text-foreground underline underline-offset-4 hover:text-primary'

export default function CookiesPage() {
  return (
    <LegalPage
      title="Polityka cookies"
      updated="10 października 2026"
      intro="Ta polityka wyjaśnia, jakich plików cookies i podobnych technologii (np. pamięci przeglądarki) używa Runbee, do czego służą i jak możesz nimi zarządzać."
    >
      <section>
        <h2>1. Czym są pliki cookies i pamięć przeglądarki</h2>
        <p>Pliki cookies to niewielkie pliki zapisywane na urządzeniu podczas odwiedzania strony. Podobną rolę pełni pamięć przeglądarki (localStorage, sessionStorage, IndexedDB), w której strona może zapisać dane na Twoim urządzeniu.</p>
      </section>

      <section>
        <h2>2. Z czego korzysta Runbee</h2>
        <ul>
          <li><strong>Logowanie i sesja (niezbędne).</strong> Firebase Authentication zapisuje w pamięci przeglądarki dane sesji, dzięki którym pozostajesz zalogowany(-a). Bez nich logowanie nie działa.</li>
          <li><strong>Wybory w trakcie rezerwacji (niezbędne do działania funkcji).</strong> Wybrany przedmiot, termin, temat i sposób płatności zapisujemy w pamięci sesji przeglądarki (sessionStorage), żeby nie zniknęły po odświeżeniu strony. Nie zapisujemy tam danych płatniczych.</li>
          <li><strong>Płatności (Stripe).</strong> Płatność odbywa się na stronie Stripe, który może zapisywać własne pliki cookies służące bezpieczeństwu i przeciwdziałaniu oszustwom. Zasady określa Stripe.</li>
          <li><strong>Statystyki odwiedzin (Vercel Analytics).</strong> Zbieramy zagregowane informacje o odwiedzinach (np. wyświetlane strony, typ urządzenia) za pomocą Vercel Analytics. Nie wykorzystuje ono plików cookies do identyfikowania Cię na różnych stronach.</li>
        </ul>
        <p>Runbee nie używa reklamowych ani marketingowych plików cookies i nie wspiera narzędzi śledzących innych firm poza wymienionymi powyżej.</p>
      </section>

      <section>
        <h2>3. Zarządzanie</h2>
        <p>Możesz zmienić ustawienia przeglądarki, by blokować lub usuwać pliki cookies i dane witryn. Zablokowanie pamięci przeglądarki uniemożliwi logowanie i może ograniczyć działanie Platformy. Dane sesji znikają po wylogowaniu lub wyczyszczeniu danych witryny.</p>
      </section>

      <section>
        <h2>4. Więcej informacji</h2>
        <p>Szczegóły przetwarzania danych osobowych opisuje <a href="/privacy" className={link}>Polityka prywatności</a>.</p>
      </section>
    </LegalPage>
  )
}
