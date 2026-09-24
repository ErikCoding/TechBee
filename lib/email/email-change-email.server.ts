import 'server-only'

import { sendTransactionalEmail, textToEmailParagraphs } from '@/lib/email/transactional-email.server'

export type SendEmailChangeVerificationEmailInput = {
  to: string
  currentEmail: string
  newEmail: string
  changeEmailLink: string
}

export async function sendEmailChangeVerificationEmail(input: SendEmailChangeVerificationEmailInput): Promise<{ id: string | null }> {
  return sendTransactionalEmail({
    to: input.to,
    subject: 'Potwierdź nowy adres e-mail w Runbee',
    preheader: 'Potwierdź zmianę adresu e-mail swojego konta.',
    title: 'Potwierdź nowy adres e-mail',
    contentHtml: textToEmailParagraphs(
      'Rozpoczęto zmianę adresu e-mail Twojego konta Runbee. Zmiana nie zostanie zakończona bez potwierdzenia nowego adresu.',
    ),
    details: [
      { label: 'Obecny adres', value: input.currentEmail },
      { label: 'Nowy adres', value: input.newEmail },
    ],
    cta: {
      label: 'Potwierdź nowy adres',
      href: input.changeEmailLink,
    },
    secondaryText: 'Jeśli to nie Ty rozpocząłeś zmianę adresu, nie potwierdzaj tej operacji.',
    text: [
      'Potwierdź nowy adres e-mail',
      '',
      'Rozpoczęto zmianę adresu e-mail Twojego konta Runbee. Zmiana nie zostanie zakończona bez potwierdzenia nowego adresu.',
      '',
      `Obecny adres: ${input.currentEmail}`,
      `Nowy adres: ${input.newEmail}`,
      '',
      `Potwierdź nowy adres: ${input.changeEmailLink}`,
      '',
      'Jeśli to nie Ty rozpocząłeś zmianę adresu, nie potwierdzaj tej operacji.',
    ].join('\n'),
  })
}
