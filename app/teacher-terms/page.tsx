import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { pageMetadata } from '@/lib/seo'
import { operatorConfig } from '@/config/operator'
import { TEACHER_TERMS_VERSION } from '@/lib/teacher-terms'

export const metadata: Metadata = pageMetadata({
  title: 'Warunki dla Nauczycieli',
  description: 'Warunki współpracy z Runbee dla Nauczycieli: status niezależnego usługodawcy, prowizja, wypłaty, weryfikacja i bezpieczeństwo uczniów.',
  path: '/teacher-terms',
})

const link = 'text-foreground underline underline-offset-4 hover:text-primary'

// SZKIC do weryfikacji przez prawnika. Pisany własnymi słowami na podstawie działania Platformy.
export default function TeacherTermsPage() {
  return (
    <LegalPage
      title="Warunki dla Nauczycieli"
      updated="3 listopada 2026"
      intro={`Warunki uzupełniają Regulamin serwisu Runbee (wersja ${TEACHER_TERMS_VERSION}). Dotyczą osób, które prowadzą lekcje przez Platformę. Pojęcia pisane wielką literą mają znaczenie z Regulaminu.`}
    >
      <section>
        <h2>1. Status Nauczyciela</h2>
        <p>1. Nauczyciel prowadzi Lekcje jako niezależny usługodawca, we własnym imieniu i na własny rachunek. Korzystanie z Platformy nie tworzy między Nauczycielem a Operatorem stosunku pracy, zlecenia, spółki ani przedstawicielstwa.</p>
        <p>2. Nauczyciel samodzielnie ustala treść, metodę i stawkę Lekcji w granicach, jakie umożliwia Platforma, oraz odpowiada za jakość i zgodność Lekcji z opisem swojego ogłoszenia.</p>
        <p>3. Operator dostarcza narzędzia: profil w giełdzie, kalendarz, rezerwacje, czat, pokój wideo, obsługę płatności i Raportów. Operator nie gwarantuje liczby zamówień ani dochodu.</p>
      </section>

      <section>
        <h2>2. Podatki i obowiązki prawne</h2>
        <p>1. Nauczyciel sam odpowiada za rozliczenie przychodów z Lekcji (podatek dochodowy, składki, ewentualną rejestrację działalności gospodarczej i inne obowiązki wynikające z przepisów). Operator nie doradza podatkowo i nie rozlicza podatków w imieniu Nauczyciela.</p>
        <p>2. Operator może mieć obowiązek przekazywania organom informacji o sprzedawcach korzystających z platform. Jeśli tak będzie, Nauczyciel poda niezbędne dane (np. imię, nazwisko, adres, numer identyfikacyjny, rachunek), a Operator zastrzega możliwość wstrzymania wypłat do ich uzupełnienia.</p>
        <p>3. Nauczyciel oświadcza, że ma prawo prowadzić Lekcje w zakresie, który deklaruje, oraz że podane dane i kwalifikacje są prawdziwe.</p>
      </section>

      <section>
        <h2>3. Zgłoszenie, weryfikacja i publikacja</h2>
        <p>1. Ogłoszenie Nauczyciela jest sprawdzane przez Operatora przed publikacją. Operator może odmówić publikacji, poprosić o uzupełnienia albo cofnąć publikację, jeśli ogłoszenie jest nieprawdziwe, wprowadza w błąd lub narusza Regulamin.</p>
        <p>2. Oznaczenie „Zweryfikowany” oznacza wyłącznie, że Operator zaakceptował ogłoszenie w opisanym trybie. Nie jest gwarancją kwalifikacji ani jakości Lekcji.</p>
        <p>3. Nauczyciel aktualizuje ogłoszenie i dostępność tak, aby odpowiadały rzeczywistości.</p>
      </section>

      <section>
        <h2>4. Prowizja i opłaty</h2>
        <p>1. Od ceny Lekcji Operator pobiera prowizję. Jej aktualna wysokość jest podawana Nauczycielowi w panelu przed aktywacją profilu; w programach promocyjnych obowiązują warunki danego programu. Operator może zmienić prowizję na przyszłe Lekcje, informując Nauczyciela z 14-dniowym wyprzedzeniem. Zmiana nie dotyczy Lekcji już zarezerwowanych i opłaconych.</p>
        <p>2. Uczeń płaci dodatkowo opłatę serwisową Runbee, która nie jest częścią wynagrodzenia Nauczyciela.</p>
        <p>3. Koszty obsługi płatności po stronie Stripe są ujmowane w rozliczeniu zgodnie z informacją w panelu Nauczyciela.</p>
      </section>

      <section>
        <h2>5. Płatności i wypłaty</h2>
        <p>1. Płatności za Lekcje przyjmuje Operator za pośrednictwem Stripe. Należność Nauczyciela (cena Lekcji po potrąceniu prowizji) jest przekazywana na jego konto Stripe Connect po potwierdzeniu Raportu, po jego automatycznym potwierdzeniu albo po rozstrzygnięciu sporu na korzyść Nauczyciela, zgodnie z Regulaminem.</p>
        <p>2. Do otrzymywania wypłat konieczne jest założenie konta Stripe Connect i przejście weryfikacji prowadzonej przez Stripe. Wypłata z konta Stripe na rachunek bankowy odbywa się na zasadach Stripe i harmonogramie widocznym w panelu Nauczyciela.</p>
        <p>3. Operator może wstrzymać przekazanie środków lub wypłatę w razie otwartego sporu, podejrzenia nadużycia, braku danych wymaganych przez Stripe lub żądania uprawnionego organu.</p>
        <p>4. Zwroty na rzecz Płatnika (m.in. po odrzuceniu rezerwacji, zaakceptowanym odwołaniu lub sporze rozstrzygniętym na rzecz Płatnika) są realizowane z płatności przyjętej przez Operatora, a Nauczyciel nie otrzymuje wynagrodzenia za Lekcję objętą zwrotem.</p>
      </section>

      <section>
        <h2>6. Prowadzenie Lekcji i Raporty</h2>
        <p>1. Nauczyciel potwierdza lub odrzuca rezerwacje w rozsądnym terminie, stawia się na Lekcję punktualnie i prowadzi ją w uzgodnionym zakresie. Odwołanie lub zmiana terminu odbywa się według Regulaminu.</p>
        <p>2. Po Lekcji Nauczyciel składa Raport zgodny z prawdą. Raport niepotwierdzony ani niezakwestionowany w ciągu 24 godzin jest potwierdzany automatycznie.</p>
        <p>3. Nauczyciel nie nagrywa Lekcji ani rozmów bez zgody wszystkich uczestników.</p>
      </section>

      <section>
        <h2>7. Zakaz omijania Platformy</h2>
        <p>Nauczyciel nie nakłania Uczniów ani Rodziców do rozliczeń poza Platformą w celu uniknięcia prowizji lub opłat w odniesieniu do osób, które poznał przez Runbee, ani do przenoszenia Lekcji poza Platformę. Naruszenie może skutkować zawieszeniem lub usunięciem konta po uprzednim uzasadnieniu zgodnie z Regulaminem.</p>
      </section>

      <section>
        <h2>8. Bezpieczeństwo małoletnich</h2>
        <p>1. Nauczyciel komunikuje się z Uczniami przede wszystkim przez czat i pokój wideo Platformy, w sposób profesjonalny i dotyczący Lekcji. Nie nawiązuje z małoletnimi prywatnych kontaktów niezwiązanych z nauką ani nie prosi o dane, których nie wymaga Lekcja.</p>
        <p>2. Nauczyciel niezwłocznie zgłasza Operatorowi (<a href={`mailto:${operatorConfig.safeguardingContactEmail}`} className={link}>{operatorConfig.safeguardingContactEmail}</a>) każdą sytuację, która może zagrażać dziecku. Operator może natychmiast zawiesić konto na czas wyjaśnienia.</p>
        <p>3. Nauczyciel oświadcza, że nie był skazany za przestępstwa przeciwko małoletnim (w tym przeciwko wolności seksualnej) i nie figuruje w rejestrach sprawców takich przestępstw, oraz niezwłocznie informuje Operatora o zmianie tej sytuacji. Operator może poprosić o dokumenty potwierdzające oświadczenie.</p>
        <p>4. Pełne zasady opisują <a href="/ochrona-maloletnich" className={link}>Standardy ochrony małoletnich</a>; Nauczyciel zobowiązuje się je stosować.</p>
      </section>

      <section>
        <h2>9. Dane osobowe</h2>
        <p>Zasady przetwarzania danych osobowych, w tym danych Nauczycieli, opisuje <a href="/privacy" className={link}>Polityka prywatności</a>. Dane weryfikacyjne i rachunek bankowy do wypłat zbiera i przetwarza Stripe.</p>
      </section>

      <section>
        <h2>10. Zakończenie współpracy i zmiany Warunków</h2>
        <p>1. Nauczyciel może w każdej chwili usunąć konto zgodnie z Regulaminem po rozliczeniu zobowiązań.</p>
        <p>2. Operator może zakończyć współpracę z ważnych przyczyn, w szczególności w razie naruszenia Regulaminu lub Warunków, z podaniem uzasadnienia.</p>
        <p>3. O zmianach Warunków Operator informuje drogą elektroniczną z 14-dniowym wyprzedzeniem. Nauczyciel, który ich nie akceptuje, może usunąć konto.</p>
        <p>4. Kontakt: <a href={`mailto:${operatorConfig.email}`} className={link}>{operatorConfig.email}</a>, {operatorConfig.name}, {operatorConfig.correspondenceAddress}.</p>
      </section>
    </LegalPage>
  )
}
