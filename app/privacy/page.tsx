import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Polityka prywatności',
  description: 'Zasady przetwarzania danych osobowych użytkowników platformy Runbee.',
  path: '/privacy',
})

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Polityka prywatności"
      updated="7 września 2026"
      intro="Niniejsza Polityka Prywatności wyjaśnia, jakie dane osobowe mogą być przetwarzane w związku z testowym korzystaniem z serwisu Runbee. To wersja robocza przed formalnym uruchomieniem działalności i powinna zostać zweryfikowana prawnie przed startem produkcyjnym."
    >
      <section>
        <h2>1. Administrator danych</h2>
        <p>Operator serwisu Runbee jest obecnie w przygotowaniu przed formalną rejestracją działalności. Dane identyfikacyjne administratora, adres do korespondencji oraz właściwy adres kontaktowy w sprawach ochrony danych zostaną uzupełnione przed produkcyjnym uruchomieniem serwisu.</p>
      </section>

      <section>
        <h2>2. Jakie dane przetwarzamy</h2>
        <ul>
          <li>dane identyfikacyjne i kontaktowe: imię, nazwisko, adres e-mail,</li>
          <li>dane konta: rola (Uczeń/Nauczyciel/Rodzic), historia lekcji, wiadomości w czacie,</li>
          <li>dane dotyczące profilu Nauczyciela: doświadczenie zawodowe, certyfikaty, umiejętności, opinie,</li>
          <li>dane transakcyjne: historia płatności, rezerwacji, wypłat nauczycieli i raportów lekcji, przetwarzane z udziałem zewnętrznego dostawcy płatności,</li>
          <li>dane plików przesyłanych przez użytkowników w czacie lub profilu, jeśli taka funkcja jest włączona,</li>
          <li>dane techniczne: adres IP, informacje o urządzeniu i przeglądarce, pliki cookies (patrz odrębna <a href="/cookies" className="text-foreground underline underline-offset-4 hover:text-primary">Polityka Cookies</a>).</li>
        </ul>
      </section>

      <section>
        <h2>3. Cele i podstawy prawne przetwarzania</h2>
        <ul>
          <li>zawarcie i wykonanie umowy o świadczenie usług (art. 6 ust. 1 lit. b RODO) — założenie konta, rezerwacja lekcji, obsługa płatności,</li>
          <li>wypełnienie obowiązków prawnych (art. 6 ust. 1 lit. c RODO) — np. rozliczenia księgowe, obsługa reklamacji,</li>
          <li>prawnie uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO) — zapobieganie nadużyciom, analiza i rozwój Serwisu, marketing bezpośredni własnych usług,</li>
          <li>zgoda (art. 6 ust. 1 lit. a RODO) — w zakresie nieobowiązkowych plików cookies i komunikacji marketingowej.</li>
        </ul>
      </section>

      <section>
        <h2>4. Odbiorcy danych</h2>
        <p>Dane mogą być przekazywane podmiotom wspierającym działanie Serwisu: dostawcom usług hostingowych i infrastruktury (w tym Google Firebase), dostawcy usług płatniczych Stripe, dostawcy wideolekcji LiveKit oraz podmiotom świadczącym usługi księgowe i prawne — wyłącznie w zakresie niezbędnym do realizacji ich zadań i na podstawie właściwych umów.</p>
      </section>

      <section>
        <h2>5. Okres przechowywania</h2>
        <p>Dane konta przechowujemy przez czas jego istnienia oraz do momentu przedawnienia ewentualnych roszczeń po jego usunięciu. Dane rozliczeniowe przechowujemy przez okres wymagany przepisami podatkowymi (co do zasady 5 lat od końca roku podatkowego).</p>
      </section>

      <section>
        <h2>6. Prawa osób, których dane dotyczą</h2>
        <p>Każdy Użytkownik ma prawo do: dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie oraz wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (UODO). Docelowy adres do obsługi tych praw zostanie uzupełniony przed startem produkcyjnym.</p>
      </section>

      <section>
        <h2>7. Przekazywanie danych poza EOG</h2>
        <p>Część dostawców infrastruktury (np. Google Firebase) może przetwarzać dane na serwerach zlokalizowanych poza Europejskim Obszarem Gospodarczym. W takich przypadkach przekazanie odbywa się na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską, zapewniających odpowiedni poziom ochrony danych.</p>
      </section>

      <section>
        <h2>8. Bezpieczeństwo danych</h2>
        <p>Stosujemy techniczne i organizacyjne środki bezpieczeństwa adekwatne do ryzyka, w tym szyfrowanie połączeń oraz kontrolę dostępu do danych, zgodnie z zasadami uwierzytelniania oferowanymi przez Firebase Authentication oraz regułami bezpieczeństwa Firestore.</p>
      </section>
    </LegalPage>
  )
}
