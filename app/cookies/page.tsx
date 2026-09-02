import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = { title: 'Polityka cookies' }

export default function CookiesPage() {
  return (
    <LegalPage
      title="Polityka cookies"
      updated="6 sierpnia 2026"
      intro="Serwis Runbee wykorzystuje pliki cookies (ciasteczka) oraz podobne technologie w celu zapewnienia prawidłowego działania strony i utrzymania sesji zalogowanego Użytkownika."
    >
      <section>
        <h2>1. Czym są pliki cookies</h2>
        <p>Pliki cookies to niewielkie pliki tekstowe zapisywane na urządzeniu Użytkownika podczas korzystania z Serwisu, wykorzystywane m.in. do zapamiętywania stanu sesji i preferencji.</p>
      </section>

      <section>
        <h2>2. Jakich cookies używamy</h2>
        <ul>
          <li><strong>Niezbędne</strong> — utrzymanie sesji zalogowanego Użytkownika (uwierzytelnianie Firebase), zapamiętanie ustawień motywu jasny/ciemny. Bez nich Serwis nie działałby poprawnie i nie wymagają zgody Użytkownika.</li>
          <li><strong>Funkcjonalne</strong> — zapamiętanie preferencji, np. ostatnio wybranych filtrów wyszukiwania w giełdzie nauczycieli.</li>
          <li><strong>Analityczne</strong> — pomagają zrozumieć, jak Użytkownicy korzystają z Serwisu, w celu jego ulepszania (używane wyłącznie po wyrażeniu zgody, jeśli dotyczy).</li>
        </ul>
      </section>

      <section>
        <h2>3. Zarządzanie zgodą</h2>
        <p>Większość przeglądarek internetowych domyślnie akceptuje pliki cookies. Użytkownik może samodzielnie zmienić ustawienia dotyczące cookies (w tym je zablokować lub usunąć) w ustawieniach swojej przeglądarki — może to jednak ograniczyć funkcjonalność Serwisu, w szczególności uniemożliwić zalogowanie się do konta.</p>
      </section>

      <section>
        <h2>4. Więcej informacji</h2>
        <p>Szczegółowe informacje o przetwarzaniu danych osobowych znajdują się w naszej <a href="/privacy" className="text-foreground underline underline-offset-4 hover:text-primary">Polityce Prywatności</a>.</p>
      </section>
    </LegalPage>
  )
}
