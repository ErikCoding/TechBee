import 'server-only'

import { sendTransactionalEmail, textToEmailParagraphs } from '@/lib/email/transactional-email.server'

type SendEmailVerificationEmailInput = {
  to: string
  firstName?: string | null
  verificationLink: string
}

export async function sendEmailVerificationEmail(input: SendEmailVerificationEmailInput): Promise<{ id: string | null }> {
  const name = input.firstName?.trim()
  const greeting = name ? `Cześć ${name}!` : 'Cześć!'
  const text = [
    greeting,
    'Dziękujemy za dołączenie do Runbee. Potwierdź swój adres e-mail, aby dokończyć konfigurację konta.',
    `Potwierdź adres e-mail: ${input.verificationLink}`,
    'Jeśli to nie Ty zakładałeś konto w Runbee, możesz zignorować tę wiadomość.',
  ].join('\n\n')

  return sendTransactionalEmail({
    to: input.to,
    subject: 'Potwierdź adres e-mail w Runbee',
    title: 'Potwierdź swój adres e-mail',
    preheader: 'Potwierdź adres e-mail i dokończ rejestrację w Runbee.',
    contentHtml: textToEmailParagraphs([
      greeting,
      'Dziękujemy za dołączenie do Runbee. Potwierdź swój adres e-mail, aby dokończyć konfigurację konta.',
    ].join('\n\n')),
    cta: {
      label: 'Potwierdź adres e-mail',
      href: input.verificationLink,
    },
    secondaryText: 'Jeśli to nie Ty zakładałeś konto w Runbee, możesz zignorować tę wiadomość.',
    text,
  })
}
