import 'server-only'

import { TRANSACTIONAL_EMAIL_REPLY_TO, sendTransactionalEmail, textToEmailParagraphs } from '@/lib/email/transactional-email.server'

export type SendPasswordChangedEmailInput = {
  to: string
}

export async function sendPasswordChangedEmail(input: SendPasswordChangedEmailInput): Promise<{ id: string | null }> {
  const contactHref = `mailto:${TRANSACTIONAL_EMAIL_REPLY_TO}`

  return sendTransactionalEmail({
    to: input.to,
    subject: 'Twoje hasło w Runbee zostało zmienione',
    preheader: 'Informacja dotycząca bezpieczeństwa Twojego konta Runbee.',
    title: 'Hasło zostało zmienione',
    contentHtml: [
      textToEmailParagraphs([
        'Hasło do Twojego konta Runbee zostało właśnie zmienione.',
        'Jeśli to Ty dokonałeś tej zmiany, nie musisz nic robić.',
      ].join('\n\n')),
      `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;border:1px solid #F4B400;border-radius:14px;background:#FFF8E1;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 6px;color:#0A0A0A;font-size:15px;font-weight:800;line-height:1.45;">To nie Ty?</p>
              <p style="margin:0;color:#334155;font-size:14px;line-height:1.65;">Jeśli nie rozpoznajesz tej zmiany, skontaktuj się z nami jak najszybciej.</p>
            </td>
          </tr>
        </table>
      `,
    ].join(''),
    cta: {
      label: 'Skontaktuj się z Runbee',
      href: contactHref,
    },
    text: [
      'Hasło zostało zmienione',
      '',
      'Hasło do Twojego konta Runbee zostało właśnie zmienione.',
      '',
      'Jeśli to Ty dokonałeś tej zmiany, nie musisz nic robić.',
      '',
      'To nie Ty?',
      'Jeśli nie rozpoznajesz tej zmiany, skontaktuj się z nami jak najszybciej.',
      '',
      `Kontakt: ${TRANSACTIONAL_EMAIL_REPLY_TO}`,
    ].join('\n'),
  })
}
