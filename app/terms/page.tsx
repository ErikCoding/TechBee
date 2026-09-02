import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = { title: 'Regulamin' }

export default function TermsPage() {
  return (
    <LegalPage
      title="Regulamin serwisu Runbee"
      updated="6 sierpnia 2026"
      intro="Niniejszy regulamin określa zasady korzystania z serwisu internetowego Runbee (dalej: „Serwis”), dostępnego pod adresem techbee.pl, prowadzonego przez Runbee Technologie Sp. z o.o. z siedzibą w Warszawie (dalej: „Usługodawca”). To wersja robocza regulaminu — przed uruchomieniem produkcyjnym Serwisu i rozpoczęciem realnych płatności powinna zostać zweryfikowana przez radcę prawnego specjalizującego się w e-commerce i usługach płatniczych."
    >
      <section>
        <h2>§1. Postanowienia ogólne</h2>
        <p>1. Regulamin określa rodzaj i zakres usług świadczonych drogą elektroniczną przez Usługodawcę, warunki ich świadczenia, warunki zawierania i rozwiązywania umów o świadczenie usług drogą elektroniczną oraz tryb postępowania reklamacyjnego, zgodnie z art. 8 ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.</p>
        <p>2. Dane Usługodawcy: Runbee Technologie Sp. z o.o., ul. Przykładowa 1, 00-001 Warszawa, NIP: 000-000-00-00, REGON: 000000000, e-mail: kontakt@techbee.pl. <em>(dane rejestrowe zostaną uzupełnione po formalnej rejestracji spółki)</em>.</p>
        <p>3. Ilekroć w Regulaminie mowa jest o „Użytkowniku”, rozumie się przez to każdą osobę korzystającą z Serwisu, w tym „Ucznia” (osobę poszukującą lekcji) oraz „Nauczyciela” (osobę oferującą lekcje).</p>
      </section>

      <section>
        <h2>§2. Rodzaj i zakres usług</h2>
        <p>Serwis umożliwia:</p>
        <ul>
          <li>przeglądanie ofert Nauczycieli bez konieczności rejestracji,</li>
          <li>założenie konta Ucznia lub Nauczyciela oraz zarządzanie profilem,</li>
          <li>rezerwację i realizację indywidualnych lekcji online w dziedzinach technicznych (automatyka, PLC, CNC, CAD, robotyka i pokrewne),</li>
          <li>komunikację między Uczniem a Nauczycielem za pośrednictwem wbudomanego czatu,</li>
          <li>prowadzenie wirtualnego portfela (BeeCoins) oraz programu lojalnościowego (BeePoints), o których mowa w §5,</li>
          <li>wystawianie i przeglądanie opinii o Nauczycielach.</li>
        </ul>
        <p>Usługodawca pełni rolę pośrednika technologicznego, umożliwiającego zawarcie umowy o przeprowadzenie lekcji bezpośrednio między Uczniem a Nauczycielem. Usługodawca nie jest stroną tej umowy i nie ponosi odpowiedzialności za jej wykonanie przez Nauczyciela, z zastrzeżeniem zasad rękojmi/gwarancji satysfakcji opisanych w §6.</p>
      </section>

      <section>
        <h2>§3. Warunki techniczne i zakładanie konta</h2>
        <p>1. Korzystanie z Serwisu wymaga urządzenia z dostępem do Internetu, aktualnej przeglądarki internetowej z obsługą JavaScript oraz aktywnego adresu e-mail.</p>
        <p>2. Rejestracja konta wymaga podania imienia i nazwiska, adresu e-mail, hasła oraz wskazania typu konta (Uczeń albo Nauczyciel). Konta administracyjne nie są zakładane samodzielnie przez Użytkowników.</p>
        <p>3. Nauczyciele podlegają dodatkowej weryfikacji doświadczenia zawodowego przed dopuszczeniem do prowadzenia lekcji, zgodnie z opisem w sekcji FAQ Serwisu.</p>
        <p>4. Użytkownik zobowiązany jest do podawania danych zgodnych z prawdą oraz do zachowania poufności danych logowania.</p>
      </section>

      <section>
        <h2>§4. Zawieranie i rozwiązywanie umów</h2>
        <p>1. Umowa o świadczenie usług drogą elektroniczną (prowadzenie konta) zostaje zawarta z chwilą skutecznej rejestracji konta i obowiązuje przez czas nieokreślony.</p>
        <p>2. Użytkownik może rozwiązać umowę w każdej chwili poprzez usunięcie konta lub zgłoszenie takiej prośby na adres kontakt@techbee.pl.</p>
        <p>3. Usługodawca może rozwiązać umowę z Użytkownikiem ze skutkiem natychmiastowym w przypadku rażącego naruszenia Regulaminu, w szczególności prób obejścia płatności realizowanych przez Serwis lub podawania nieprawdziwych danych.</p>
        <p>4. Rezerwacja lekcji stanowi odrębną umowę zawieraną pomiędzy Uczniem a Nauczycielem za pośrednictwem Serwisu. Warunki anulowania: bezpłatne odwołanie lekcji jest możliwe do 24 godzin przed jej rozpoczęciem; odwołanie w późniejszym terminie może wiązać się z częściowym potrąceniem opłaty na rzecz Nauczyciela.</p>
      </section>

      <section>
        <h2>§5. Płatności, BeeCoins i BeePoints</h2>
        <p>1. Rozliczenia pieniężne w Serwisie realizowane są za pośrednictwem zewnętrznego dostawcy usług płatniczych, posiadającego wymagane prawem zezwolenia (np. krajowej lub małej instytucji płatniczej nadzorowanej przez Komisję Nadzoru Finansowego). Środki wpłacane przez Użytkowników są przechowywane zgodnie z zasadami tego dostawcy, a nie bezpośrednio przez Usługodawcę.</p>
        <p>2. „BeeCoins” to wewnętrzna jednostka rozliczeniowa Serwisu, odzwierciedlająca saldo środków dostępnych do wykorzystania na lekcje. Nie stanowi ona elektronicznego instrumentu płatniczego w rozumieniu odrębnych przepisów i nie może być wykorzystywana poza Serwisem.</p>
        <p>3. „BeePoints” to niezbywalny program lojalnościowy — punkty przyznawane za aktywność w Serwisie (ukończone lekcje, opinie, polecenia), wymienialne wyłącznie na zniżki i korzyści opisane w zakładce BeePoints. Punkty nie stanowią środka płatniczego, nie podlegają wypłacie w gotówce i wygasają w przypadku usunięcia konta.</p>
        <p>4. Prowizja Usługodawcy oraz szczegółowy cennik dla Nauczycieli są prezentowane w panelu Nauczyciela przed aktywacją profilu.</p>
      </section>

      <section>
        <h2>§6. Reklamacje</h2>
        <p>1. Reklamacje dotyczące funkcjonowania Serwisu lub przeprowadzonych lekcji można zgłaszać na adres kontakt@techbee.pl, podając opis problemu oraz dane umożliwiające identyfikację rezerwacji.</p>
        <p>2. Usługodawca rozpatruje reklamacje w terminie 14 dni kalendarzowych od dnia ich otrzymania i informuje Użytkownika o wyniku postępowania na podany adres e-mail.</p>
        <p>3. Jeżeli lekcja nie odbyła się z winy Nauczyciela lub nie spełniła uzgodnionych wcześniej warunków, Uczniowi przysługuje zwrot środków w BeeCoins na zasadach opisanych w sekcji FAQ.</p>
      </section>

      <section>
        <h2>§7. Odstąpienie od umowy (konsumenci)</h2>
        <p>Zgodnie z ustawą o prawach konsumenta, Uczeń będący konsumentem może odstąpić od umowy o dostarczenie usługi cyfrowej w terminie 14 dni bez podania przyczyny. Prawo to nie przysługuje w zakresie, w jakim przed upływem tego terminu lekcja została w pełni zrealizowana za wyraźną zgodą Ucznia, który został poinformowany o utracie prawa odstąpienia.</p>
      </section>

      <section>
        <h2>§8. Odpowiedzialność</h2>
        <p>1. Usługodawca dokłada starań, aby Serwis działał nieprzerwanie, jednak nie gwarantuje pełnej dostępności i zastrzega możliwość przerw technicznych.</p>
        <p>2. Usługodawca nie ponosi odpowiedzialności za treści merytoryczne przekazywane przez Nauczycieli w trakcie lekcji ani za skutki decyzji podjętych przez Użytkowników na ich podstawie.</p>
        <p>3. Zabronione jest dostarczanie przez Użytkowników treści o charakterze bezprawnym oraz wykorzystywanie Serwisu w sposób zakłócający jego funkcjonowanie.</p>
      </section>

      <section>
        <h2>§9. Dane osobowe</h2>
        <p>Zasady przetwarzania danych osobowych Użytkowników opisane są w odrębnej <a href="/privacy" className="text-foreground underline underline-offset-4 hover:text-primary">Polityce Prywatności</a>.</p>
      </section>

      <section>
        <h2>§10. Postanowienia końcowe</h2>
        <p>1. W sprawach nieuregulowanych Regulaminem zastosowanie mają przepisy prawa polskiego, w tym Kodeksu cywilnego oraz ustawy o świadczeniu usług drogą elektroniczną.</p>
        <p>2. Spory będą rozstrzygane przez sąd właściwy dla siedziby Usługodawcy, z zastrzeżeniem bezwzględnie obowiązujących przepisów chroniących konsumentów.</p>
        <p>3. Usługodawca zastrzega sobie prawo do zmiany Regulaminu; o zmianach Użytkownicy zostaną poinformowani drogą elektroniczną z 14-dniowym wyprzedzeniem.</p>
      </section>
    </LegalPage>
  )
}
