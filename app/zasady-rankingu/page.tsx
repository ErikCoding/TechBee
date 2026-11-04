import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Jak sortujemy nauczycieli i weryfikujemy opinie',
  description: 'Przejrzyste zasady kolejności nauczycieli na giełdzie Runbee, oznaczeń „Wyróżniony” i „Pierwsza 50” oraz sposobu publikowania opinii.',
  path: '/zasady-rankingu',
})

const link = 'text-foreground underline underline-offset-4 hover:text-primary'

// SZKIC do weryfikacji przez prawnika (informacje o rankingu i opiniach dla konsumentów — dyrektywa Omnibus).
export default function RankingRulesPage() {
  return (
    <LegalPage
      title="Jak sortujemy nauczycieli i weryfikujemy opinie"
      updated="3 listopada 2026"
      intro="Chcemy, żebyś wiedział(a), dlaczego widzisz nauczycieli w takiej kolejności i skąd biorą się opinie."
    >
      <section>
        <h2>1. Domyślna kolejność</h2>
        <p>Na giełdzie domyślnie wyświetlamy najpierw nauczycieli z oznaczeniem „Wyróżniony”, a potem pozostałych. Oznaczenie „Wyróżniony” nadaje Operator ręcznie, na podstawie przeglądu profilu. Obecnie nie jest to płatna reklama ani miejsce do kupienia. Jeśli kiedykolwiek wprowadzimy płatną promocję, oznaczymy ją wyraźnie jako reklamę i zaktualizujemy tę stronę.</p>
      </section>

      <section>
        <h2>2. Sortowanie, które wybierasz sam(a)</h2>
        <ul>
          <li><strong>Najwyżej oceniani</strong> – według średniej oceny z opinii.</li>
          <li><strong>Cena: od najniższej / od najwyższej</strong> – według stawki za 60 minut.</li>
          <li><strong>Najwięcej lekcji</strong> – według liczby przeprowadzonych lekcji.</li>
        </ul>
        <p>Możesz też filtrować po przedmiocie, poziomie nauczania i cenie.</p>
      </section>

      <section>
        <h2>3. Oznaczenia na profilach</h2>
        <ul>
          <li><strong>Zweryfikowany</strong> – Operator zaakceptował ogłoszenie nauczyciela. To nie gwarancja kwalifikacji ani jakości lekcji.</li>
          <li><strong>Wyróżniony</strong> – ręczne wyróżnienie przez Operatora.</li>
          <li><strong>Pierwsza 50</strong> – udział w programie dla pierwszych nauczycieli na Runbee (preferencyjna prowizja przez ograniczony czas). Oznaczenie jest widoczne, bo program wiąże się z promocją profilu.</li>
        </ul>
      </section>

      <section>
        <h2>4. Skąd biorą się opinie</h2>
        <p>Opinię może wystawić tylko osoba, która odbyła lekcję z danym nauczycielem; platforma sprawdza to automatycznie. Każda para uczeń–nauczyciel ma jedną opinię, którą można później zmienić. Opinie nie są kupowane ani zamawiane, a Operator nie zmienia ocen. Usuwamy wyłącznie opinie naruszające prawo lub <a href="/terms" className={link}>Regulamin</a> (np. obraźliwe). Opinię lub profil możesz zgłosić przez <a href="/zglos-problem" className={link}>formularz zgłoszeń</a>.</p>
      </section>

      <section>
        <h2>5. Zmiany</h2>
        <p>O istotnych zmianach zasad sortowania poinformujemy na tej stronie.</p>
      </section>
    </LegalPage>
  )
}
