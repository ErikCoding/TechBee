import 'server-only'

import { Resend } from 'resend'

const RUNBEE_HOME_URL = 'https://runbee.pl'
const RUNBEE_LOGO_URL = `${RUNBEE_HOME_URL}/icon.png`
const BRAND_YELLOW = '#F4B400'

export const TRANSACTIONAL_EMAIL_FROM = 'Runbee <noreply@mail.runbee.pl>'
export const TRANSACTIONAL_EMAIL_REPLY_TO = 'kontakt@runbee.pl'

let resendClient: Resend | null = null

export class TransactionalEmailError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransactionalEmailError'
  }
}

type EmailCta = {
  label: string
  href: string
}

type EmailDetail = {
  label: string
  value: string
}

type RunbeeEmailTemplateInput = {
  title: string
  preheader?: string
  contentHtml: string
  details?: EmailDetail[]
  cta?: EmailCta
  secondaryText?: string
}

export type SendTransactionalEmailInput = RunbeeEmailTemplateInput & {
  to: string | string[]
  subject: string
  text?: string
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    throw new TransactionalEmailError('RESEND_API_KEY is not configured.')
  }

  resendClient ??= new Resend(apiKey)
  return resendClient
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function textToEmailParagraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;color:inherit;font-size:16px;line-height:1.65;">${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('')
}

function renderButton(cta: EmailCta): string {
  const href = escapeHtml(cta.href)
  const label = escapeHtml(cta.label)

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 0;">
      <tr>
        <td bgcolor="${BRAND_YELLOW}" style="border-radius:10px;background:${BRAND_YELLOW};">
          <a href="${href}" style="display:inline-block;padding:13px 20px;color:#0A0A0A;font-size:15px;font-weight:700;line-height:1.2;text-decoration:none;border-radius:10px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `
}

function renderDetails(details: EmailDetail[] | undefined): string {
  if (!details?.length) return ''

  const rows = details
    .map((detail, index) => {
      const isLast = index === details.length - 1
      return `
        <tr>
          <td style="padding:${index === 0 ? '0' : '13px'} 0 ${isLast ? '0' : '13px'};border-bottom:${isLast ? '0' : '1px solid #E4E4E7'};">
            <div style="margin:0 0 4px;color:#71717A;font-size:12px;font-weight:700;line-height:1.35;text-transform:uppercase;letter-spacing:0.03em;">${escapeHtml(detail.label)}</div>
            <div class="runbee-detail-value" style="margin:0;color:#18181B;font-size:15px;font-weight:650;line-height:1.45;">${escapeHtml(detail.value)}</div>
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="runbee-details" style="margin:28px 0 0;border:1px solid #E4E4E7;border-radius:14px;background:#FAFAFA;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  `
}

function renderSecondaryText(value: string | undefined): string {
  if (!value?.trim()) return ''

  return `
    <p style="margin:24px 0 0;color:#71717A;font-size:14px;line-height:1.65;">
      ${escapeHtml(value.trim()).replace(/\n/g, '<br />')}
    </p>
  `
}

export function renderRunbeeEmailTemplate(input: RunbeeEmailTemplateInput): string {
  const preheader = input.preheader ? escapeHtml(input.preheader) : ''
  const title = escapeHtml(input.title)

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${title}</title>
    <style>
      @media (max-width: 620px) {
        .runbee-shell { padding: 18px 10px !important; }
        .runbee-card { border-radius: 14px !important; }
        .runbee-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .runbee-title { font-size: 25px !important; }
        .runbee-tagline { display: none !important; }
      }
      @media (prefers-color-scheme: dark) {
        .runbee-page { background: #0A0A0A !important; }
        .runbee-card { background: #141414 !important; border-color: #27272A !important; }
        .runbee-header { background: #0A0A0A !important; border-color: #27272A !important; }
        .runbee-title, .runbee-wordmark-run { color: #FAFAFA !important; }
        .runbee-copy { color: #E4E4E7 !important; }
        .runbee-muted { color: #A1A1AA !important; }
        .runbee-details { background: #18181B !important; border-color: #27272A !important; }
        .runbee-detail-value { color: #FAFAFA !important; }
        .runbee-footer-link { color: #FBBF24 !important; }
        .runbee-footer { background: #111111 !important; border-color: #27272A !important; }
      }
    </style>
  </head>
  <body class="runbee-page" style="margin:0;padding:0;background:#F8F8F8;font-family:Inter,Arial,Helvetica,sans-serif;color:#0A0A0A;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${preheader}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="runbee-page" style="background:#F8F8F8;margin:0;padding:0;">
      <tr>
        <td align="center" class="runbee-shell" style="padding:30px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="runbee-card" style="max-width:600px;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:18px;overflow:hidden;">
            <tr>
              <td class="runbee-header runbee-pad" style="padding:24px 30px;background:#FFFFFF;border-bottom:1px solid #E4E4E7;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:10px;">
                            <img src="${RUNBEE_LOGO_URL}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border:0;border-radius:10px;" />
                          </td>
                          <td style="vertical-align:middle;">
                            <span class="runbee-wordmark-run" style="color:#0A0A0A;font-size:22px;font-weight:800;line-height:1;letter-spacing:-0.01em;">Run</span><span style="color:${BRAND_YELLOW};font-size:22px;font-weight:800;line-height:1;letter-spacing:-0.01em;">bee</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" class="runbee-tagline" style="font-size:12px;font-weight:700;line-height:1.4;text-transform:uppercase;color:#B45309;letter-spacing:0.04em;">
                      Platforma lekcji online
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="runbee-pad" style="padding:36px 30px 32px;">
                <h1 class="runbee-title" style="margin:0 0 18px;color:#0A0A0A;font-size:30px;line-height:1.18;font-weight:800;letter-spacing:-0.01em;">
                  ${title}
                </h1>
                <div class="runbee-copy" style="color:#334155;font-size:16px;line-height:1.65;">
                  ${input.contentHtml}
                </div>
                ${renderDetails(input.details)}
                ${input.cta ? renderButton(input.cta) : ''}
                ${renderSecondaryText(input.secondaryText)}
              </td>
            </tr>
            <tr>
              <td class="runbee-footer runbee-pad" style="padding:22px 30px 26px;background:#FAFAFA;border-top:1px solid #E4E4E7;">
                <p class="runbee-muted" style="margin:0 0 8px;color:#71717A;font-size:13px;line-height:1.55;">
                  To automatyczna wiadomość od Runbee.
                </p>
                <p class="runbee-muted" style="margin:0 0 8px;color:#71717A;font-size:13px;line-height:1.55;">
                  Potrzebujesz pomocy? Napisz na
                  <a class="runbee-footer-link" href="mailto:${TRANSACTIONAL_EMAIL_REPLY_TO}" style="color:#52525B;text-decoration:underline;">${TRANSACTIONAL_EMAIL_REPLY_TO}</a>
                </p>
                <p style="margin:0;color:#71717A;font-size:13px;line-height:1.55;">
                  <a href="${RUNBEE_HOME_URL}" style="color:${BRAND_YELLOW};font-weight:800;text-decoration:none;">runbee.pl</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<{ id: string | null }> {
  const resend = getResendClient()
  const html = renderRunbeeEmailTemplate(input)

  try {
    const result = await resend.emails.send({
      from: TRANSACTIONAL_EMAIL_FROM,
      replyTo: TRANSACTIONAL_EMAIL_REPLY_TO,
      to: input.to,
      subject: input.subject,
      html,
      text: input.text,
    })

    if (result.error) {
      console.error('[email] Resend send failed', {
        name: result.error.name,
        message: result.error.message,
      })
      throw new TransactionalEmailError('Resend rejected the email request.')
    }

    const id = result.data?.id ?? null
    console.info('[email] Transactional email sent', { id })
    return { id }
  } catch (error) {
    if (error instanceof TransactionalEmailError) throw error
    console.error('[email] Transactional email send failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    throw new TransactionalEmailError('Could not send transactional email.')
  }
}
