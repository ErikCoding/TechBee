import 'server-only'

import { sendTransactionalEmail, textToEmailParagraphs } from '@/lib/email/transactional-email.server'

export async function sendAccountDeletionRequestEmail(input: { to: string; name?: string | null }): Promise<{ id: string | null }> {
  return sendTransactionalEmail({
    to: input.to,
    subject: 'Przyjęliśmy żądanie usunięcia konta Runbee',
    title: 'Żądanie usunięcia konta zostało przyjęte',
    preheader: 'Zapisaliśmy Twoje żądanie i przekażemy je do bezpiecznej obsługi.',
    contentHtml: textToEmailParagraphs(
      `Cześć${input.name ? ` ${input.name}` : ''},\n\nPrzyjęliśmy żądanie usunięcia konta Runbee. Ze względu na możliwe lekcje, pakiety, rozliczenia lub obowiązki administracyjne konto zostanie sprawdzone przed wykonaniem dalszych kroków.\n\nDo czasu zakończenia obsługi nie usuwamy automatycznie danych finansowych, historii lekcji ani rozliczeń.`,
    ),
    text: 'Przyjęliśmy żądanie usunięcia konta Runbee. Konto zostanie sprawdzone przed wykonaniem dalszych kroków.',
    secondaryText: 'Jeśli nie składałeś(-aś) takiego żądania, skontaktuj się z Runbee: kontakt@runbee.pl.',
  })
}

