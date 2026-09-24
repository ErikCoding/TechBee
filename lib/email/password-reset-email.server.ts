import 'server-only'

import { sendTransactionalEmail, textToEmailParagraphs } from '@/lib/email/transactional-email.server'

export type SendPasswordResetEmailInput = {
  to: string
  resetLink: string
}

export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<{ id: string | null }> {
  return sendTransactionalEmail({
    to: input.to,
    subject: 'Zmień hasło w Runbee',
    preheader: 'Ustaw nowe hasło do swojego konta Runbee.',
    title: 'Zmień swoje hasło',
    contentHtml: textToEmailParagraphs('Otrzymaliśmy prośbę o zmianę hasła do Twojego konta Runbee.'),
    cta: {
      label: 'Ustaw nowe hasło',
      href: input.resetLink,
    },
    secondaryText: 'Jeśli to nie Ty wysłałeś tę prośbę, możesz zignorować tę wiadomość.',
    text: [
      'Zmień swoje hasło',
      '',
      'Otrzymaliśmy prośbę o zmianę hasła do Twojego konta Runbee.',
      '',
      `Ustaw nowe hasło: ${input.resetLink}`,
      '',
      'Jeśli to nie Ty wysłałeś tę prośbę, możesz zignorować tę wiadomość.',
    ].join('\n'),
  })
}
