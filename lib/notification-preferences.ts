export const EMAIL_NOTIFICATION_GROUPS = [
  {
    id: 'lessons',
    label: 'Lekcje',
    description: 'Rezerwacje, zmiany terminów, odwołania i przypomnienia.',
    items: [
      { id: 'bookingCreated', label: 'Nowa rezerwacja', description: 'Potwierdzenia utworzenia rezerwacji.' },
      { id: 'bookingChanged', label: 'Zmiana rezerwacji', description: 'Prośby i decyzje dotyczące zmiany terminu.' },
      { id: 'bookingCancelled', label: 'Odwołanie lekcji', description: 'Informacje o anulowaniu rezerwacji.' },
      { id: 'lessonReminder', label: 'Przypomnienia o lekcji', description: 'Przypomnienia przed rozpoczęciem lekcji.' },
    ],
  },
  {
    id: 'reports',
    label: 'Raporty',
    description: 'Raport po lekcji i jego potwierdzenie.',
    items: [
      { id: 'reportReady', label: 'Raport gotowy', description: 'Nauczyciel wysłał raport po lekcji.' },
      { id: 'reportAccepted', label: 'Raport zaakceptowany', description: 'Raport został zaakceptowany ręcznie lub automatycznie.' },
    ],
  },
  {
    id: 'payments',
    label: 'Płatności',
    description: 'Potwierdzenia płatności, zwroty i wypłaty.',
    items: [
      { id: 'paymentConfirmation', label: 'Potwierdzenia płatności', description: 'Informacje o opłaconych lekcjach.' },
      { id: 'refund', label: 'Zwroty', description: 'Informacje o wykonanych zwrotach.' },
      { id: 'payout', label: 'Wypłaty', description: 'Informacje o wypłatach dla nauczycieli.' },
    ],
  },
  {
    id: 'messages',
    label: 'Wiadomości',
    description: 'Aktywność w czacie Runbee.',
    items: [
      { id: 'newMessage', label: 'Nowa wiadomość', description: 'Powiadomienia o nowych wiadomościach.' },
    ],
  },
  {
    id: 'product',
    label: 'Produkt',
    description: 'Informacje produktowe niezwiązane bezpośrednio z bezpieczeństwem konta.',
    items: [
      { id: 'productUpdates', label: 'Aktualizacje produktu', description: 'Nowości i zmiany w Runbee.' },
    ],
  },
] as const

export type EmailNotificationGroup = typeof EMAIL_NOTIFICATION_GROUPS[number]['id']
export type EmailNotificationType = {
  [Group in keyof EmailNotificationPreferences]: `${Extract<Group, string>}.${Extract<keyof EmailNotificationPreferences[Group], string>}`
}[keyof EmailNotificationPreferences]

export type EmailNotificationPreferences = {
  lessons: {
    bookingCreated: boolean
    bookingChanged: boolean
    bookingCancelled: boolean
    lessonReminder: boolean
  }
  reports: {
    reportReady: boolean
    reportAccepted: boolean
  }
  payments: {
    paymentConfirmation: boolean
    refund: boolean
    payout: boolean
  }
  messages: {
    newMessage: boolean
  }
  product: {
    productUpdates: boolean
  }
}

export type NotificationPreferences = {
  email: EmailNotificationPreferences
}

export const DEFAULT_EMAIL_NOTIFICATION_PREFERENCES: EmailNotificationPreferences = {
  lessons: {
    bookingCreated: true,
    bookingChanged: true,
    bookingCancelled: true,
    lessonReminder: true,
  },
  reports: {
    reportReady: true,
    reportAccepted: true,
  },
  payments: {
    paymentConfirmation: true,
    refund: true,
    payout: true,
  },
  messages: {
    newMessage: true,
  },
  product: {
    productUpdates: false,
  },
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: DEFAULT_EMAIL_NOTIFICATION_PREFERENCES,
}

const emailNotificationTypes = new Set(
  EMAIL_NOTIFICATION_GROUPS.flatMap((group) => group.items.map((item) => `${group.id}.${item.id}`)),
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cloneDefaults(): NotificationPreferences {
  return {
    email: {
      lessons: { ...DEFAULT_EMAIL_NOTIFICATION_PREFERENCES.lessons },
      reports: { ...DEFAULT_EMAIL_NOTIFICATION_PREFERENCES.reports },
      payments: { ...DEFAULT_EMAIL_NOTIFICATION_PREFERENCES.payments },
      messages: { ...DEFAULT_EMAIL_NOTIFICATION_PREFERENCES.messages },
      product: { ...DEFAULT_EMAIL_NOTIFICATION_PREFERENCES.product },
    },
  }
}

export function isEmailNotificationType(value: string): value is EmailNotificationType {
  return emailNotificationTypes.has(value)
}

export function normalizeNotificationPreferences(input: unknown): NotificationPreferences {
  const normalized = cloneDefaults()
  const root = isRecord(input) ? input : {}
  const email = isRecord(root.email) ? root.email : {}
  const normalizedEmail = normalized.email as unknown as Record<string, Record<string, boolean>>

  for (const group of EMAIL_NOTIFICATION_GROUPS) {
    const rawGroupInput = email[group.id]
    const groupInput = isRecord(rawGroupInput) ? rawGroupInput : {}
    for (const item of group.items) {
      const value = groupInput[item.id]
      if (typeof value === 'boolean') {
        normalizedEmail[group.id][item.id] = value
      }
    }
  }

  return normalized
}

export function setEmailNotificationPreference(
  preferences: NotificationPreferences,
  type: EmailNotificationType,
  enabled: boolean,
): NotificationPreferences {
  const next = normalizeNotificationPreferences(preferences)
  if (!isEmailNotificationType(type)) return next
  const [group, key] = type.split('.') as [EmailNotificationGroup, string]
  const nextEmail = next.email as unknown as Record<string, Record<string, boolean>>
  nextEmail[group][key] = enabled
  return next
}

export function getEmailNotificationPreference(input: unknown, type: EmailNotificationType): boolean {
  const preferences = normalizeNotificationPreferences(input)
  if (!isEmailNotificationType(type)) return false
  const [group, key] = type.split('.') as [EmailNotificationGroup, string]
  const email = preferences.email as unknown as Record<string, Record<string, boolean>>
  return email[group]?.[key] === true
}

export function shouldSendEmailNotification(input: unknown, type: EmailNotificationType): boolean {
  return getEmailNotificationPreference(input, type)
}

export function canUpdateOwnNotificationPreferences(callerUid: string | null | undefined, targetUid: string): boolean {
  return Boolean(callerUid && callerUid === targetUid)
}

export function emailNotificationFieldPath(type: EmailNotificationType): string {
  return `notificationPreferences.email.${type}`
}
