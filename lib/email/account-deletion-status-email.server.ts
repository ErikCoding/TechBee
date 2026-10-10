import 'server-only'

import { sendProductNotificationEmail } from '@/lib/email/product-notifications.server'

/**
 * Account-deletion status mail. Goes through the same outbox as every
 * other product email (idempotency key, durable payload, retry via
 * /api/cron/email-outbox) and is "required": it is a decision about the
 * user's own account, so it ignores notification preferences. The address
 * is always read from the user's profile — never from the caller.
 */
export async function sendAccountDeletionStatusEmail(input: {
  eventId: string
  recipientUid: string
  subject: string
  title: string
  body: string
}): Promise<{ status: 'sent' | 'duplicate' | 'failed' | 'not_configured' | 'missing_recipient' | 'skipped_preferences' | 'expired' | 'sending'; id?: string | null }> {
  return sendProductNotificationEmail({
    eventId: input.eventId,
    recipientUid: input.recipientUid,
    type: 'account.deletionStatus',
    required: true,
    subject: input.subject,
    title: input.title,
    preheader: input.subject,
    body: input.body,
    secondaryText: 'Jeśli masz pytania, skontaktuj się z Runbee: kontakt@runbee.pl.',
  })
}
