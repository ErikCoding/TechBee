import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Regulamin',
  description: 'Regulamin korzystania z platformy Runbee: konta, rezerwacje lekcji, pakiety, płatności, raporty, spory i usuwanie konta.',
  path: '/terms',
})

const link = 'text-foreground underline underline-offset-4 hover:text-primary'

export default function TermsPage() {
  return (
    <LegalPage
      title="Regulamin serwisu Runbee"
      updated="10 października 2026"
      intro="Regulamin opisuje, jak działa platforma Runbee, jakie prawa i obowiązki mają Uczniowie, Rodzice i Nauczyciele oraz jak rozliczamy lekcje, pakiety, zwroty i usuwanie kont."
    >
      <section>
        <h2>§1. Postanowienia ogólne i definicje</h2>
        <p>1. Regulamin określa rodzaj i zakres usług świadczonych drogą elektroniczną przez Operatora, warunki ich świadczenia, warunki zawierania i rozwiązywania umów o świadczenie tych usług oraz tryb postępowania reklamacyjnego, zgodnie z art. 8 ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.</p>
        <p>2. Operatorem platformy Runbee dostępnej pod adresem runbee.pl („Platforma”) jest Bartosz Prokop („Operator”). Kontakt z Operatorem, w tym w sprawach reklamacyjnych i dotyczących danych osobowych, jest możliwy pod adresem <a href="mailto:kontakt@runbee.pl" className={link}>kontakt@runbee.pl</a>.</p>
        <p>3. Użyte w Regulaminie określenia oznaczają:</p>
        <ul>
          <li><strong>Użytkownik</strong> – każda osoba korzystająca z Platformy, w tym Uczeń, Rodzic i Nauczyciel,</li>
          <li><strong>Uczeń</strong> – Użytkownik, który uczy się podczas lekcji,</li>
          <li><strong>Rodzic</strong> – Użytkownik, którego konto zostało powiązane z kontem Ucznia za pomocą kodu powiązania i który może w imieniu Ucznia rezerwować, opłacać lekcje oraz potwierdzać raporty,</li>
          <li><strong>Nauczyciel</strong> – Użytkownik, którego zgłoszenie zostało zaakceptowane przez Operatora i który prowadzi lekcje,</li>
          <li><strong>Lekcja</strong> – indywidualne zajęcia online prowadzone przez Nauczyciela, w tym lekcja próbna,</li>
          <li><strong>Pakiet</strong> – zestaw 5 lub 10 lekcji kupowany z góry u wybranego Nauczyciela,</li>
          <li><strong>Raport</strong> – informacja o przeprowadzonej Lekcji składana przez Nauczyciela po jej zakończeniu,</li>
          <li><strong>Płatnik</strong> – Uczeń lub Rodzic, który opłaca Lekcję lub Pakiet.</li>
        </ul>
      </section>

      <section>
        <h2>§2. Rodzaj i zakres usług</h2>
        <p>1. Platforma umożliwia:</p>
        <ul>
          <li>przeglądanie ofert Nauczycieli bez rejestracji,</li>
          <li>założenie konta Ucznia, Rodzica lub Nauczyciela i zarządzanie profilem oraz ustawieniami,</li>
          <li>rezerwację i opłacenie pojedynczych Lekcji oraz zakup i wykorzystanie Pakietów,</li>
          <li>prowadzenie Lekcji w pokoju wideo dostępnym w Platformie,</li>
          <li>komunikację między Użytkownikami za pomocą wbudowanego czatu, w tym wysyłanie załączników,</li>
          <li>składanie i potwierdzanie Raportów oraz zgłaszanie sporów,</li>
          <li>wystawianie opinii o Nauczycielach,</li>
          <li>otrzymywanie powiadomień w Platformie i wiadomości e-mail dotyczących konta, Lekcji i płatności,</li>
          <li>udział w programie lojalnościowym BeePoints.</li>
        </ul>
        <p>2. Operator jest pośrednikiem technologicznym. Umowa o przeprowadzenie Lekcji zawierana jest między Płatnikiem (Uczniem lub Rodzicem) a Nauczycielem. Operator nie jest stroną tej umowy i nie odpowiada za merytoryczną treść Lekcji, z zastrzeżeniem postanowień o płatnościach, Raportach, sporach i reklamacjach zawartych w Regulaminie.</p>
        <p>3. Platforma nie nagrywa Lekcji. Użytkownik nie może samodzielnie nagrywać Lekcji ani rozmów bez zgody pozostałych uczestników.</p>
      </section>

      <section>
        <h2>§3. Warunki techniczne, rejestracja i konta</h2>
        <p>1. Korzystanie z Platformy wymaga urządzenia z dostępem do Internetu, aktualnej przeglądarki obsługującej JavaScript oraz aktywnego adresu e-mail. Wideolekcje wymagają ponadto kamery i mikrofonu oraz zgody przeglądarki na ich użycie.</p>
        <p>2. Rejestracja wymaga podania imienia i nazwiska, adresu e-mail, hasła, wskazania typu konta (Uczeń, Rodzic lub Nauczyciel) oraz potwierdzenia adresu e-mail. Konta administracyjne nie są zakładane samodzielnie przez Użytkowników.</p>
        <p>3. Użytkownik podaje dane zgodne z prawdą, dba o poufność danych logowania i odpowiada za działania wykonane na swoim koncie. Podejrzenie nieuprawnionego dostępu należy niezwłocznie zgłosić Operatorowi. Zmiana adresu e-mail i hasła oraz złożenie wniosku o usunięcie konta wymagają ponownego uwierzytelnienia.</p>
        <p>4. Konto Rodzica można powiązać z kontem Ucznia za pomocą krótkotrwałego, jednorazowego kodu wygenerowanego przez Ucznia. Powiązanie umożliwia Rodzicowi rezerwowanie i opłacanie Lekcji dla Ucznia oraz zarządzanie Raportami. Rodzic może zdecydować, czy Uczeń również może potwierdzać Raporty.</p>
        <p>5. Zgłoszenie Nauczyciela jest sprawdzane przez Operatora przed opublikowaniem profilu. Operator może odmówić publikacji profilu lub poprosić o uzupełnienie danych. Wypłaty wynagrodzenia wymagają połączenia konta Nauczyciela z usługą Stripe Connect i przejścia weryfikacji prowadzonej przez Stripe.</p>
        <p>6. Operator może zablokować lub zawiesić konto w przypadku naruszenia Regulaminu, podejrzenia nadużycia albo na żądanie uprawnionego organu. O zablokowaniu konta Operator może poinformować Użytkownika drogą elektroniczną, o ile przepisy lub względy bezpieczeństwa tego nie wykluczają.</p>
      </section>

      <section>
        <h2>§4. Zawieranie i rozwiązywanie umowy o świadczenie usług drogą elektroniczną</h2>
        <p>1. Umowa o świadczenie usług drogą elektroniczną (prowadzenie konta) zostaje zawarta z chwilą skutecznej rejestracji i obowiązuje przez czas nieokreślony.</p>
        <p>2. Użytkownik może rozwiązać umowę w każdej chwili, składając wniosek o usunięcie konta według §11 albo kontaktując się z Operatorem.</p>
        <p>3. Operator może rozwiązać umowę ze skutkiem natychmiastowym w razie rażącego naruszenia Regulaminu, w szczególności prób obejścia płatności realizowanych przez Platformę, podawania nieprawdziwych danych lub zachowań zagrażających bezpieczeństwu innych Użytkowników.</p>
      </section>

      <section>
        <h2>§5. Rezerwacje i Lekcje</h2>
        <p>1. Płatnik wybiera Nauczyciela, przedmiot, długość i termin Lekcji spośród dostępnych terminów, podaje temat zajęć i opłaca rezerwację. Rezerwacja powstaje po potwierdzeniu płatności przez Stripe. Wolne terminy są pokazywane w Platformie na bieżąco, a Operator nie gwarantuje, że wybrany termin pozostanie dostępny do chwili zakończenia płatności.</p>
        <p>2. Nauczyciel potwierdza lub odrzuca rezerwację. Do czasu potwierdzenia Lekcja ma status oczekującej. Odrzucenie rezerwacji skutkuje zwrotem płatności zgodnie z §7 ust. 6.</p>
        <p>3. Lekcja próbna może być dostępna u Nauczycieli, którzy ją włączyli. Dla jednej pary Uczeń–Nauczyciel można wykorzystać jedną płatną lekcję próbną.</p>
        <p>4. Odwołanie lub przełożenie potwierdzonej Lekcji wymaga prośby złożonej w Platformie i akceptacji drugiej strony. Zasady zwrotu opisuje §7.</p>
        <p>5. Do pokoju wideo można dołączyć w oknie czasowym wskazanym w Platformie. Użytkownik odpowiada za sprawność własnego sprzętu i łącza. Operator nie odpowiada za przerwy w Lekcji spowodowane przyczynami po stronie Użytkownika.</p>
        <p>6. Nauczyciel prowadzi Lekcje z należytą starannością, w uzgodnionym terminie i zakresie. Uczeń lub Rodzic stawia się na Lekcję punktualnie. Nieobecność jednej ze stron może zostać zgłoszona jako spór (§8).</p>
      </section>

      <section>
        <h2>§6. Pakiety lekcji</h2>
        <p>1. Pakiet obejmuje 5 lub 10 lekcji i jest przypisany do wybranego Nauczyciela, przedmiotu oraz długości Lekcji. Pakiet można kupić samodzielnie albo razem z rezerwacją pierwszej Lekcji.</p>
        <p>2. Rezerwacja Lekcji z Pakietu rezerwuje jeden kredyt, a po przeprowadzeniu Lekcji kredyt zostaje wykorzystany. Nie powoduje to naliczenia kolejnej opłaty serwisowej. Lekcje z Pakietu można rezerwować także cyklicznie.</p>
        <p>3. Kredyt wraca do Pakietu, gdy rezerwacja zostanie odrzucona lub gdy anulowanie Lekcji zostanie zaakceptowane.</p>
        <p>4. Pakiet nie ma w Platformie ustalonego terminu ważności. Zwroty zakupionych Pakietów wymagają kontaktu z Operatorem pod adresem <a href="mailto:kontakt@runbee.pl" className={link}>kontakt@runbee.pl</a> do czasu wprowadzenia automatycznego procesu zwrotów.</p>
      </section>

      <section>
        <h2>§7. Płatności, opłata serwisowa i zwroty</h2>
        <p>1. Płatności są realizowane w złotych polskich za pośrednictwem Stripe Payments Europe, Ltd. Operator nie przechowuje numerów kart płatniczych. Dane płatnicze przetwarza Stripe na zasadach określonych w swoich regulaminach.</p>
        <p>2. Do każdego nowego zakupu doliczana jest obowiązkowa opłata serwisowa Runbee, prezentowana Płatnikowi przed płatnością jako osobna pozycja. Wynosi ona 3% wartości zamówienia, nie mniej niż 2,99 zł, i nie zależy od metody płatności.</p>
        <p>3. W przypadku Pakietu opłata serwisowa jest naliczana jednorazowo od wartości całego Pakietu.</p>
        <p>4. Z wynagrodzenia Nauczyciela Operator potrąca prowizję. Jej wysokość oraz cennik są prezentowane Nauczycielowi w panelu Nauczyciela przed aktywacją profilu, a w programach promocyjnych także w warunkach danego programu.</p>
        <p>5. Środki za Lekcję są pobierane z góry. Operator przekazuje należność Nauczycielowi (po potrąceniu prowizji) na jego konto Stripe Connect po potwierdzeniu Raportu, po jego automatycznym potwierdzeniu albo po rozstrzygnięciu sporu na korzyść Nauczyciela (§8). Wypłata środków z konta Stripe Connect na rachunek bankowy Nauczyciela odbywa się na zasadach Stripe i może zależeć od ukończenia weryfikacji.</p>
        <p>6. Pełny zwrot płatności za pojedynczą Lekcję następuje w szczególności po odrzuceniu rezerwacji, po zaakceptowaniu prośby o odwołanie oraz po rozstrzygnięciu sporu na korzyść Płatnika. Zwracana jest cała rzeczywiście zapłacona kwota, w tym opłata serwisowa. Zwrot jest realizowany tą samą metodą płatności przez Stripe, a czas jego zaksięgowania zależy od banku.</p>
        <p>7. Operator może wstrzymać przekazanie środków albo wypłatę w razie podejrzenia nadużycia, otwartego sporu lub żądania uprawnionego organu.</p>
      </section>

      <section>
        <h2>§8. Raporty, potwierdzanie Lekcji i spory</h2>
        <p>1. Po zakończeniu Lekcji Nauczyciel składa Raport. Raport zostaje przekazany osobie uprawnionej do jego potwierdzenia, czyli Rodzicowi powiązanemu z Uczniem w chwili złożenia Raportu albo samemu Uczniowi, a także Uczniowi, jeśli Rodzic na to zezwolił.</p>
        <p>2. Osoba uprawniona może potwierdzić Raport albo zgłosić spór, wskazując jego powód (Lekcja się nie odbyła lub Nauczyciel był nieobecny, Lekcja była niezgodna z opisem, niska jakość Lekcji, inny powód) oraz opis.</p>
        <p>3. Jeżeli w ciągu 24 godzin od złożenia Raportu osoba uprawniona nie potwierdzi go ani nie zgłosi sporu, Raport zostaje potwierdzony automatycznie, a środki są przekazywane Nauczycielowi zgodnie z §7 ust. 5.</p>
        <p>4. Przy otwartym sporze środki za Lekcję pozostają wstrzymane. Spór rozstrzyga Operator na podstawie Raportu, opisu stron i dostępnych w Platformie danych o Lekcji. Rozstrzygnięcie polega na pełnym zwrocie płatności na rzecz Płatnika albo przekazaniu środków Nauczycielowi. Strony są informowane o wyniku drogą elektroniczną.</p>
      </section>

      <section>
        <h2>§9. Czat, treści Użytkowników i opinie</h2>
        <p>1. Czat służy do komunikacji dotyczącej Lekcji. Załączniki mogą mieć do 8 MB i być obrazami, plikami PDF, ZIP lub dokumentami tekstowymi i biurowymi.</p>
        <p>2. Zabronione jest przesyłanie treści bezprawnych, naruszających prawa osób trzecich lub szkodliwych oraz nakłanianie do zawierania płatności poza Platformą w celu obejścia opłat.</p>
        <p>3. Operator nie monitoruje rozmów na bieżąco. Uprawniony pracownik lub współpracownik Operatora może zapoznać się z rozmową, gdy jest to niezbędne do obsługi zgłoszenia, rozpatrzenia sporu lub reklamacji albo zapewnienia bezpieczeństwa Użytkowników.</p>
        <p>4. Uczeń lub Rodzic może wystawić jedną opinię o Nauczycielu, z którym odbył Lekcję, i może ją później zmienić. Opinie są publikowane przy profilu Nauczyciela. Treści opinii nie mogą naruszać prawa ani dóbr osobistych.</p>
      </section>

      <section>
        <h2>§10. Powiadomienia i BeePoints</h2>
        <p>1. Operator wysyła wiadomości e-mail niezbędne do działania konta i bezpieczeństwa (np. potwierdzenie adresu, reset hasła, zmiana e-mail lub hasła, status wniosku o usunięcie konta, potwierdzenia płatności, spory i wypłaty). Pozostałe powiadomienia, w tym przypominania o Lekcjach i nowe wiadomości, Użytkownik może włączyć lub wyłączyć w ustawieniach konta. Informacje o nowościach Runbee wysyłamy wyłącznie osobom, które je włączyły.</p>
        <p>2. BeePoints to niezbywalny program lojalnościowy, w którym punkty są przyznawane za aktywność w Platformie i wymieniane wyłącznie na korzyści opisane w zakładce BeePoints. Punkty nie są środkiem płatniczym i nie podlegają wypłacie w gotówce. Punkty są usuwane wraz z kontem.</p>
      </section>

      <section>
        <h2>§11. Usuwanie konta i zakończenie świadczenia usług</h2>
        <p>1. Wniosek o usunięcie konta Uczeń, Rodzic lub Nauczyciel składa w ustawieniach konta, po podaniu hasła i wpisaniu wymaganego potwierdzenia. Konta administratorów nie są usuwane w trybie samoobsługowym. Na złożenie wniosku Operator odpowiada wiadomością e-mail.</p>
        <p>2. Do czasu rozpatrzenia wniosku konto działa na zasadach ogólnych, chyba że Operator zamknie do niego dostęp. Zamknięcie dostępu blokuje logowanie, ale nie oznacza jeszcze usunięcia danych.</p>
        <p>3. Operator sprawdza, czy z kontem nie są związane zobowiązania: aktywne lub oczekujące Lekcje, Pakiety z niewykorzystanymi lub zarezerwowanymi kredytami, nierozliczone Raporty lub należności, oczekujące wypłaty i otwarte spory. Usunięcie konta jest możliwe dopiero po ich zakończeniu lub rozstrzygnięciu. Użytkownik jest o tym informowany wiadomością e-mail. Nauczyciel z kontem Stripe Connect odpowiada za samodzielne sprawdzenie i zamknięcie swojego konta w Stripe; Operator nie zamyka go ani nie wypłaca środków w jego imieniu.</p>
        <p>4. Po zakończeniu weryfikacji Operator trwale usuwa konto. Usunięcie jest nieodwracalne i obejmuje:</p>
        <ul>
          <li>usunięcie konta logowania (adres e-mail, hasło) oraz profilu Użytkownika razem z ustawieniami i powiązaniami rodzinnymi,</li>
          <li>usunięcie powiadomień, punktów BeePoints, zdjęcia profilowego, załączników wysłanych w czacie oraz treści wiadomości napisanych przez Użytkownika,</li>
          <li>usunięcie publicznego profilu Nauczyciela,</li>
          <li>zastąpienie imienia i zdjęcia Użytkownika napisem „Usunięty użytkownik” w rozmowach, Lekcjach i opiniach widocznych dla innych Użytkowników.</li>
        </ul>
        <p>5. Operator zachowuje, w ograniczonym zakresie i bez wyświetlania imienia usuniętego Użytkownika, dane niezbędne do rozliczeń, wypełnienia obowiązków prawnych oraz dochodzenia lub obrony roszczeń, w szczególności zapisy Lekcji, Raportów i sporów, Pakietów, płatności, zwrotów, przelewów i wypłat. Szczegóły i okresy przechowywania opisuje <a href="/privacy" className={link}>Polityka prywatności</a>.</p>
        <p>6. Po usunięciu konta ten sam adres e-mail może zostać użyty do utworzenia nowego konta, które nie przejmuje danych, Pakietów ani historii poprzedniego konta.</p>
      </section>

      <section>
        <h2>§12. Reklamacje</h2>
        <p>1. Reklamacje dotyczące działania Platformy lub przeprowadzonych Lekcji można zgłaszać na adres <a href="mailto:kontakt@runbee.pl" className={link}>kontakt@runbee.pl</a>, podając opis problemu oraz dane pozwalające zidentyfikować konto i rezerwację.</p>
        <p>2. Operator rozpatruje reklamację w terminie 14 dni kalendarzowych od jej otrzymania i informuje o wyniku na adres e-mail zgłaszającego.</p>
        <p>3. Zgłoszenie sporu do Raportu (§8) nie wyłącza prawa do reklamacji.</p>
      </section>

      <section>
        <h2>§13. Odstąpienie od umowy (konsumenci)</h2>
        <p>1. Konsument może odstąpić od umowy zawartej na odległość w terminie 14 dni bez podania przyczyny, zgodnie z ustawą z dnia 30 maja 2014 r. o prawach konsumenta. Oświadczenie można wysłać na adres <a href="mailto:kontakt@runbee.pl" className={link}>kontakt@runbee.pl</a>.</p>
        <p>2. Prawo odstąpienia nie przysługuje w zakresie, w jakim przed upływem 14 dni Lekcja została w pełni wykonana za wyraźną zgodą konsumenta, który został poinformowany o utracie tego prawa.</p>
        <p>3. Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, np. zwrócić się do miejskiego lub powiatowego rzecznika konsumentów albo do wojewódzkiego inspektoratu Inspekcji Handlowej.</p>
      </section>

      <section>
        <h2>§14. Odpowiedzialność</h2>
        <p>1. Operator dokłada starań, aby Platforma działała bez przerw, ale nie gwarantuje stałej dostępności i zastrzega możliwość przerw technicznych.</p>
        <p>2. Operator nie ponosi odpowiedzialności za treści merytoryczne przekazywane przez Nauczycieli podczas Lekcji ani za skutki decyzji podjętych na ich podstawie, z zastrzeżeniem odpowiedzialności, której nie można wyłączyć na mocy bezwzględnie obowiązujących przepisów.</p>
        <p>3. Zabronione jest korzystanie z Platformy w sposób zakłócający jej działanie, w tym obchodzenie zabezpieczeń lub automatyczne pobieranie danych.</p>
      </section>

      <section>
        <h2>§15. Dane osobowe i pliki cookies</h2>
        <p>Zasady przetwarzania danych osobowych opisuje <a href="/privacy" className={link}>Polityka prywatności</a>, a zasady dotyczące plików cookies i podobnych technologii <a href="/cookies" className={link}>Polityka cookies</a>.</p>
      </section>

      <section>
        <h2>§16. Postanowienia końcowe</h2>
        <p>1. W sprawach nieuregulowanych Regulaminem stosuje się przepisy prawa polskiego, w tym Kodeksu cywilnego, ustawy o świadczeniu usług drogą elektroniczną i ustawy o prawach konsumenta.</p>
        <p>2. Spory z Użytkownikami będącymi konsumentami rozstrzyga sąd właściwy według przepisów ogólnych. Spory z pozostałymi Użytkownikami rozstrzyga sąd właściwy dla siedziby Operatora.</p>
        <p>3. Operator może zmienić Regulamin z ważnych przyczyn, takich jak zmiana przepisów, funkcji Platformy lub zasad płatności. O zmianach Użytkownicy zostaną poinformowani drogą elektroniczną z 14-dniowym wyprzedzeniem. Zmiana nie wpływa na Lekcje i Pakiety opłacone przed jej wejściem w życie. Użytkownik, który jej nie akceptuje, może usunąć konto zgodnie z §11.</p>
      </section>
    </LegalPage>
  )
}
