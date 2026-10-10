import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Polityka prywatności',
  description: 'Jak Runbee przetwarza dane osobowe: zakres, cele, odbiorcy, okresy przechowywania, prawa użytkownika i usuwanie konta.',
  path: '/privacy',
})

const link = 'text-foreground underline underline-offset-4 hover:text-primary'

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Polityka prywatności"
      updated="10 października 2026"
      intro="Polityka wyjaśnia, jakie dane osobowe przetwarzamy w związku z platformą Runbee, po co, na jakiej podstawie, komu je przekazujemy, jak długo je przechowujemy i jak możesz skorzystać ze swoich praw, w tym usunąć konto."
    >
      <section>
        <h2>1. Administrator danych</h2>
        <p>Administratorem danych osobowych jest Bartosz Prokop, Operator platformy Runbee (runbee.pl), wskazany w <a href="/terms" className={link}>Regulaminie</a>. We wszystkich sprawach dotyczących danych osobowych, w tym wykonywania praw opisanych w pkt 9, możesz napisać na adres <a href="mailto:kontakt@runbee.pl" className={link}>kontakt@runbee.pl</a>.</p>
      </section>

      <section>
        <h2>2. Jakie dane przetwarzamy</h2>
        <ul>
          <li><strong>Konto i profil:</strong> imię i nazwisko, adres e-mail, rola (Uczeń, Rodzic, Nauczyciel), hasło (przechowywane wyłącznie w postaci zabezpieczonej przez Firebase Authentication), zdjęcie profilowe, ustawienia i preferencje powiadomień.</li>
          <li><strong>Powiązanie Rodzic–Uczeń:</strong> kody powiązania oraz informacja o połączonych kontach.</li>
          <li><strong>Profil Nauczyciela:</strong> dane ze zgłoszenia i profilu, takie jak przedmioty, doświadczenie, opis, umiejętności, języki, stawki, dostępność, lokalizacja, zdjęcie, oraz opinie o Nauczycielu.</li>
          <li><strong>Lekcje:</strong> termin, przedmiot, temat, czas trwania, cena, status, Raporty i spory (w tym opisy wpisane przez strony), historia zmian terminu i odwołań.</li>
          <li><strong>Komunikacja:</strong> wiadomości i załączniki w czacie, zgłoszenia z formularza kontaktowego (imię, adres e-mail, temat i treść), powiadomienia w Platformie.</li>
          <li><strong>Płatności i wypłaty:</strong> identyfikatory i statusy transakcji, kwoty, opłaty, zwroty, przelewy, wypłaty, Pakiety i ich wykorzystanie. Numerów kart płatniczych nie przechowujemy, przetwarza je Stripe. Dane weryfikacyjne Nauczycieli potrzebne do wypłat (tożsamość, rachunek bankowy) zbiera i przetwarza Stripe jako odrębny podmiot.</li>
          <li><strong>Wideolekcje:</strong> dane techniczne połączenia (identyfikator pokoju i uczestnika, stan mikrofonu i kamery). Lekcji nie nagrywamy.</li>
          <li><strong>BeePoints:</strong> saldo i historia przyznanych punktów.</li>
          <li><strong>Dane techniczne:</strong> adres IP, dane o urządzeniu i przeglądarce, znaczniki czasu, logi bezpieczeństwa i ograniczania liczby prób (np. przy resecie hasła), statystyki odwiedzin (zob. <a href="/cookies" className={link}>Polityka cookies</a>).</li>
          <li><strong>Wnioski o usunięcie konta:</strong> przebieg wniosku, decyzje i notatki administratora, wynik kontroli zobowiązań.</li>
        </ul>
        <p>Dane podajesz sam(a), powstają one podczas korzystania z Platformy albo pochodzą od innych Użytkowników (np. Raport napisany przez Nauczyciela, opinia Ucznia) i od Stripe (status płatności i konta wypłat).</p>
        <p>Wiadomości i załączniki w czacie oraz Raporty są widoczne dla uczestników rozmowy lub Lekcji. W uzasadnionych przypadkach (obsługa zgłoszenia, spór, reklamacja, bezpieczeństwo) mogą się z nimi zapoznać upoważnione osoby po stronie Operatora.</p>
      </section>

      <section>
        <h2>3. Cele i podstawy prawne</h2>
        <ul>
          <li><strong>Założenie i prowadzenie konta, umożliwienie rezerwacji Lekcji, Pakietów, czatu i wideolekcji, obsługa płatności i rozliczeń</strong> – wykonanie umowy (art. 6 ust. 1 lit. b RODO).</li>
          <li><strong>Księgowość, podatki, obsługa zwrotów i reklamacji, wykonanie obowiązków wynikających z przepisów</strong> – obowiązek prawny (art. 6 ust. 1 lit. c RODO).</li>
          <li><strong>Bezpieczeństwo Platformy, zapobieganie nadużyciom i obchodzeniu płatności, rozstrzyganie sporów, dochodzenie i obrona roszczeń, podstawowe statystyki i rozwój Platformy</strong> – prawnie uzasadniony interes Administratora (art. 6 ust. 1 lit. f RODO).</li>
          <li><strong>Powiadomienia e-mail niezbędne do działania konta i bezpieczeństwa</strong> (potwierdzenie adresu, reset hasła, zmiana e-mail lub hasła, status wniosku o usunięcie konta, płatności, spory, wypłaty) – wykonanie umowy i prawnie uzasadniony interes. Pozostałe powiadomienia (przypomnienia o Lekcjach, nowe wiadomości) wysyłamy zgodnie z ustawieniami konta, a informacje o nowościach Runbee tylko po ich włączeniu – zgoda (art. 6 ust. 1 lit. a RODO), którą możesz cofnąć w każdej chwili w ustawieniach.</li>
        </ul>
        <p>Podanie danych jest dobrowolne, ale niezbędne do założenia konta i korzystania z Platformy. Dane Nauczyciela wymagane przez Stripe są niezbędne do wypłat.</p>
        <p>Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, które wywołują skutki prawne, z jednym wyjątkiem opisanym w Regulaminie: Raport niepotwierdzony ani niezakwestionowany w ciągu 24 godzin jest potwierdzany automatycznie i środki są przekazywane Nauczycielowi. Spory rozstrzyga człowiek.</p>
      </section>

      <section>
        <h2>4. Odbiorcy danych</h2>
        <p>Dane przekazujemy wyłącznie w zakresie potrzebnym do realizacji celów z pkt 3:</p>
        <ul>
          <li><strong>Inni Użytkownicy:</strong> uczestnicy Lekcji widzą się wzajemnie w zakresie niezbędnym do jej przeprowadzenia (imię, zdjęcie, temat, termin, treść rozmowy i Raportów). Profil Nauczyciela i opinie są publiczne.</li>
          <li><strong>Google (Firebase Authentication, Cloud Firestore, Cloud Storage)</strong> – uwierzytelnianie, baza danych i przechowywanie plików.</li>
          <li><strong>Stripe</strong> (Stripe Payments Europe, Ltd. i podmioty z grupy Stripe) – płatności, zwroty, konta Stripe Connect i wypłaty Nauczycieli.</li>
          <li><strong>Resend</strong> – wysyłka wiadomości e-mail z Platformy.</li>
          <li><strong>LiveKit</strong> – transmisja audio i wideo podczas Lekcji.</li>
          <li><strong>Vercel</strong> – statystyki odwiedzin Platformy (Vercel Analytics).</li>
          <li><strong>Dostawca hostingu aplikacji</strong> – udostępnianie Platformy w Internecie.</li>
          <li><strong>Doradcy i podmioty obsługujące Operatora</strong> – księgowość, obsługa prawna i techniczna, o ile jest to potrzebne.</li>
          <li><strong>Organy publiczne i inne podmioty uprawnione z mocy prawa</strong> – gdy obowiązek przekazania wynika z przepisów.</li>
        </ul>
        <p>Dostawców, którzy przetwarzają dane w naszym imieniu, wiążą umowy powierzenia lub standardowe warunki przetwarzania. Stripe w zakresie płatności i weryfikacji Nauczycieli działa również jako samodzielny administrator danych.</p>
      </section>

      <section>
        <h2>5. Przekazywanie danych poza Europejski Obszar Gospodarczy</h2>
        <p>Część dostawców (np. Google, Stripe, Vercel, Resend, LiveKit) może przetwarzać dane poza EOG, w tym w Stanach Zjednoczonych. Przekazanie odbywa się na podstawie decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony albo standardowych klauzul umownych i dodatkowych zabezpieczeń zapewniających ochronę zgodną z RODO. Kopię zabezpieczeń możesz uzyskać, pisząc na adres z pkt 1.</p>
      </section>

      <section>
        <h2>6. Jak długo przechowujemy dane</h2>
        <ul>
          <li><strong>Dane konta i profilu</strong> – do czasu usunięcia konta (pkt 7).</li>
          <li><strong>Dokumentacja księgowa i podatkowa</strong> (płatności, opłaty, faktury i rachunki, wypłaty, zwroty) – przez okres wymagany przepisami podatkowymi i rachunkowymi, co do zasady 5 lat od końca roku podatkowego.</li>
          <li><strong>Lekcje, Raporty, spory, Pakiety i zapisy płatności</strong> – po usunięciu konta zachowujemy je w ograniczonym zakresie, bez wyświetlania Twojego imienia, przez czas potrzebny do rozliczeń, wypełnienia obowiązków prawnych oraz dochodzenia i obrony roszczeń do czasu ich przedawnienia.</li>
          <li><strong>Wiadomości, załączniki, powiadomienia i punkty BeePoints</strong> – do usunięcia konta, a treść Twoich wiadomości i załączniki usuwamy razem z kontem.</li>
          <li><strong>Zgłoszenia z formularza kontaktowego</strong> – przez czas potrzebny do ich obsługi i ewentualnych roszczeń.</li>
          <li><strong>Logi bezpieczeństwa i dane techniczne</strong> – przez czas niezbędny do zapewnienia bezpieczeństwa i wykrywania nadużyć, a następnie usuwamy je lub anonimizujemy.</li>
          <li><strong>Wnioski o usunięcie konta</strong> – zachowujemy ich przebieg (identyfikator konta, status, daty i kroki) jako dowód wykonania Twojego żądania, bez danych kontaktowych.</li>
        </ul>
      </section>

      <section>
        <h2>7. Usunięcie konta w praktyce</h2>
        <p>Wniosek o usunięcie konta składasz w ustawieniach po podaniu hasła i wpisaniu potwierdzenia. Przed usunięciem sprawdzamy, czy nie masz aktywnych lub oczekujących Lekcji, Pakietów z kredytami, nierozliczonych Raportów lub należności, oczekujących wypłat ani otwartych sporów. Jeśli masz konto Stripe Connect, sam(a) sprawdzasz i zamykasz je w Stripe, a my niczego tam nie zamykamy ani nie wypłacamy za Ciebie. Usunięcie jest nieodwracalne.</p>
        <p>Po usunięciu konta:</p>
        <ul>
          <li><strong>usuwamy:</strong> konto logowania (adres e-mail i hasło), profil z ustawieniami i powiązaniami rodzinnymi, powiadomienia, punkty BeePoints, zdjęcie profilowe i załączniki z czatu, publiczny profil Nauczyciela oraz treść wiadomości, które napisałeś(-aś), a także zapisy kolejki wiadomości e-mail dotyczące konta,</li>
          <li><strong>anonimizujemy:</strong> Twoje imię i zdjęcie w rozmowach, Lekcjach i opiniach widocznych dla innych Użytkowników (zastępuje je napis „Usunięty użytkownik”); ocena i treść opinii zostają bez powiązania z kontem,</li>
          <li><strong>zachowujemy:</strong> Lekcje, Raporty, spory, Pakiety oraz zapisy płatności, zwrotów, przelewów i wypłat, a także zdarzenia ze Stripe, w zakresie opisanym w pkt 6, oraz znacznik techniczny usuniętego konta (identyfikator, rola, data usunięcia).</li>
        </ul>
        <p>Dane przechowywane przez Stripe, Google, Resend, LiveKit i Vercel podlegają ich własnym zasadom i okresom przechowywania. Kopie zapasowe są nadpisywane zgodnie z harmonogramem dostawców.</p>
      </section>

      <section>
        <h2>8. Bezpieczeństwo danych</h2>
        <p>Stosujemy środki techniczne i organizacyjne odpowiednie do ryzyka, w tym: szyfrowane połączenia (HTTPS), uwierzytelnianie przez Firebase Authentication, reguły dostępu do bazy i plików, rozdzielenie uprawnień Użytkowników i administratorów, ponowne uwierzytelnienie przy wrażliwych operacjach (zmiana e-mail i hasła, wniosek o usunięcie konta), ograniczanie liczby prób, weryfikację podpisów zdarzeń płatniczych oraz dziennik czynności administratora przy wnioskach o usunięcie konta. Pełne dane płatnicze nie trafiają na nasze serwery.</p>
      </section>

      <section>
        <h2>9. Twoje prawa</h2>
        <p>Masz prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie oraz cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed jej cofnięciem). Większość danych poprawisz w ustawieniach konta, a usunięcie konta zgłosisz według pkt 7. W pozostałych sprawach napisz na <a href="mailto:kontakt@runbee.pl" className={link}>kontakt@runbee.pl</a>. Odpowiemy bez zbędnej zwłoki, co do zasady w ciągu miesiąca.</p>
        <p>Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa), jeśli uważasz, że przetwarzamy dane niezgodnie z prawem.</p>
      </section>

      <section>
        <h2>10. Cookies i podobne technologie</h2>
        <p>Informacje o plikach cookies, pamięci przeglądarki i statystykach znajdziesz w <a href="/cookies" className={link}>Polityce cookies</a>.</p>
      </section>

      <section>
        <h2>11. Zmiany Polityki</h2>
        <p>Będziemy aktualizować Politykę, gdy zmienią się funkcje Platformy, dostawcy lub przepisy. Datę ostatniej aktualizacji podajemy na początku dokumentu, a o istotnych zmianach poinformujemy w Platformie lub e-mailem.</p>
      </section>
    </LegalPage>
  )
}
