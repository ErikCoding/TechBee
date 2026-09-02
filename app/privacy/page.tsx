import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = { title: 'Polityka prywatności' }

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Polityka prywatności"
      updated="6 sierpnia 2026"
      intro="Niniejsza Polityka Prywatności wyjaśnia, jakie dane osobowe przetwarzamy w związku z korzystaniem z serwisu Runbee, w jakim celu i na jakiej podstawie, zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO). To wersja bazowa, do weryfikacji prawnej przed uruchomieniem produkcyjnym."
    >
      <section>
        <h2>1. Administrator danych</h2>
        <p>Administratorem danych osobowych jest Runbee Technologie Sp. z o.o. z siedzibą w Warszawie, e-mail kontaktowy w sprawach ochrony danych: prywatnosc@techbee.pl.</p>
      </section>

      <section>
        <h2>2. Jakie dane przetwarzamy</h2>
        <ul>
          <li>dane identyfikacyjne i kontaktowe: imię, nazwisko, adres e-mail,</li>
          <li>dane konta: rola (Uczeń/Nauczyciel), historia lekcji, wiadomości w czacie,</li>
          <li>dane dotyczące profilu Nauczyciela: doświadczenie zawodowe, certyfikaty, umiejętności, opinie,</li>
          <li>dane transakcyjne: historia płatności i salda BeeCoins/BeePoints (przetwarzane częściowo przez zewnętrznego dostawcę płatności),</li>
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
        <p>Dane mogą być przekazywane podmiotom wspierającym działanie Serwisu: dostawcom usług hostingowych i infrastruktury (w tym Google Firebase), dostawcy usług płatniczych realizującemu rozliczenia w ramach portfela, oraz podmiotom świadczącym usługi księgowe i prawne — wyłącznie w zakresie niezbędnym do realizacji ich zadań i na podstawie umów powierzenia przetwarzania danych.</p>
      </section>

      <section>
        <h2>5. Okres przechowywania</h2>
        <p>Dane konta przechowujemy przez czas jego istnienia oraz do momentu przedawnienia ewentualnych roszczeń po jego usunięciu. Dane rozliczeniowe przechowujemy przez okres wymagany przepisami podatkowymi (co do zasady 5 lat od końca roku podatkowego).</p>
      </section>

      <section>
        <h2>6. Prawa osób, których dane dotyczą</h2>
        <p>Każdy Użytkownik ma prawo do: dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie oraz wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (UODO). W celu skorzystania z tych praw prosimy o kontakt na adres prywatnosc@techbee.pl.</p>
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
