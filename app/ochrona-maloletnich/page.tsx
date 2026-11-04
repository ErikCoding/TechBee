import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { pageMetadata } from '@/lib/seo'
import { operatorConfig } from '@/config/operator'

export const metadata: Metadata = pageMetadata({
  title: 'Standardy ochrony małoletnich',
  description: 'Zasady bezpiecznego kontaktu nauczycieli z dziećmi na Runbee, sposób zgłaszania niepokojących sytuacji i osoba odpowiedzialna.',
  path: '/ochrona-maloletnich',
})

const link = 'text-foreground underline underline-offset-4 hover:text-primary'

// SZKIC do weryfikacji przez prawnika (ustawa z 28 lipca 2023 r., tzw. ustawa Kamilka — Kodeks rodzinny i opiekuńczy, rozdz. 4b).
export default function MinorProtectionPage() {
  return (
    <LegalPage
      title="Standardy ochrony małoletnich"
      updated="3 listopada 2026"
      intro="Na Runbee uczą się także dzieci i młodzież. Ten dokument opisuje zasady, które mają zapewnić im bezpieczeństwo: jak mogą się z nimi kontaktować nauczyciele, co robimy, gdy coś budzi niepokój, i kto za to odpowiada."
    >
      <section>
        <h2>1. Do kogo odnoszą się standardy</h2>
        <p>Do wszystkich osób korzystających z Platformy w kontakcie z małoletnimi, w szczególności do Nauczycieli prowadzących Lekcje oraz do pracowników i współpracowników Operatora, którzy mają dostęp do zgłoszeń lub rozmów w celu ich rozpatrzenia.</p>
      </section>

      <section>
        <h2>2. Osoba odpowiedzialna</h2>
        <p>Za wdrożenie i przestrzeganie standardów odpowiada {operatorConfig.name}, Operator Platformy. Zgłoszenia i pytania: <a href={`mailto:${operatorConfig.safeguardingContactEmail}`} className={link}>{operatorConfig.safeguardingContactEmail}</a>, a także formularz <a href="/zglos-problem" className={link}>Zgłoś problem</a>.</p>
      </section>

      <section>
        <h2>3. Zasady kontaktu nauczyciela z dzieckiem</h2>
        <ul>
          <li>Lekcje i rozmowy prowadzimy w Platformie (pokój wideo i czat). Nauczyciel nie umawia się z uczniem na rozmowy w innych komunikatorach ani na spotkania na żywo.</li>
          <li>Komunikacja dotyczy nauki: jest uprzejma, rzeczowa i bez treści o charakterze seksualnym, przemocowym, wulgarnym ani poniżającym.</li>
          <li>Nauczyciel nie prosi dziecka o zdjęcia, dane osobowe, adres ani informacje o rodzinie, jeśli nie jest to konieczne do Lekcji, nie wręcza prezentów ani nie obiecuje przysług w zamian za tajemnicę.</li>
          <li>Nauczyciel nie nagrywa Lekcji ani rozmów bez zgody wszystkich uczestników. Platforma sama Lekcji nie nagrywa.</li>
          <li>Rodzic może w każdej chwili połączyć swoje konto z kontem dziecka, widzieć jego rezerwacje i raporty oraz zarządzać płatnościami.</li>
          <li>Nauczyciel nie utrzymuje z dzieckiem kontaktu prywatnego poza Platformą i nie nakłania do rozliczeń poza nią.</li>
        </ul>
      </section>

      <section>
        <h2>4. Weryfikacja nauczycieli</h2>
        <p>Ogłoszenie każdego Nauczyciela jest sprawdzane przez Operatora przed publikacją. Nauczyciel składa oświadczenie, że nie był skazany za przestępstwa przeciwko małoletnim ani nie figuruje w rejestrach sprawców takich przestępstw, i zobowiązuje się poinformować Operatora o zmianie tej sytuacji. Operator może poprosić o dodatkowe dokumenty, a w razie wątpliwości zawiesić konto do wyjaśnienia.</p>
      </section>

      <section>
        <h2>5. Jak zgłosić niepokojącą sytuację</h2>
        <p>Zgłoś ją przez formularz <a href="/zglos-problem" className={link}>Zgłoś problem</a> (przycisk jest też przy profilu nauczyciela i w pokoju lekcji) lub e-mailem. Zgłoszenia dotyczące bezpieczeństwa dziecka oznaczamy jako pilne. Jeśli dziecko jest w bezpośrednim niebezpieczeństwie, zadzwoń najpierw pod numer 112. Dzieci i młodzież mogą też skorzystać z telefonu zaufania 116 111.</p>
      </section>

      <section>
        <h2>6. Jak reagujemy</h2>
        <ol>
          <li>Zgłoszenie trafia do osoby odpowiedzialnej i jest rozpatrywane w pierwszej kolejności, zwykle w ciągu jednego dnia roboczego.</li>
          <li>W razie podejrzenia zagrożenia dziecka Operator może od razu zawiesić konto lub ukryć profil Nauczyciela na czas wyjaśnienia i zabezpieczyć dane, które dokumentują sprawę.</li>
          <li>Operator kontaktuje się z rodzicem lub opiekunem dziecka i, jeśli to konieczne, z odpowiednimi organami (policja, prokuratura, sąd rodzinny, ośrodek pomocy).</li>
          <li>Zgłaszający jest informowany o wyniku w zakresie, na jaki pozwala prawo. Nie ujawniamy jego tożsamości osobie, której zgłoszenie dotyczy.</li>
          <li>Konto Nauczyciela, który naruszył standardy, może zostać trwale usunięte.</li>
        </ol>
      </section>

      <section>
        <h2>7. Dane i poufność</h2>
        <p>Informacje o zgłoszeniach dotyczących dzieci są dostępne tylko osobom, które muszą je znać, aby sprawę wyjaśnić. Zasady przetwarzania danych opisuje <a href="/privacy" className={link}>Polityka prywatności</a>.</p>
      </section>

      <section>
        <h2>8. Przegląd standardów</h2>
        <p>Operator sprawdza i w razie potrzeby aktualizuje standardy co najmniej raz na dwa lata oraz po każdym incydencie, który ujawnił luki w zasadach. Wersja z datą aktualizacji jest zawsze dostępna na tej stronie.</p>
      </section>
    </LegalPage>
  )
}
