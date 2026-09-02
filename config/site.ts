// ─────────────────────────────────────────────────────────────
// Central site configuration. Change values here instead of
// hunting for magic strings across the codebase.
// ─────────────────────────────────────────────────────────────

export const siteConfig = {
  name: 'Runbee',
  legalName: 'Runbee Technologie Sp. z o.o.',
  tagline: 'Ucz się praktycznych umiejętności przemysłowych od certyfikowanych ekspertów',
  description:
    'Połącz się z certyfikowanymi specjalistami PLC, CNC, CAD i automatyki przemysłowej na indywidualne lekcje online.',
  url: 'https://techbee.pl',
  locale: 'pl-PL',
  currency: {
    code: 'PLN',
    symbol: 'zł',
    // Formats an amount the way the whole app should — change this once, everywhere updates.
    format: (amount: number) => `${amount.toLocaleString('pl-PL')} zł`,
  },
  coinName: 'BeeCoins',
  pointsName: 'BeePoints',
  links: {
    marketplace: '/marketplace',
    dashboardStudent: '/dashboard/student',
    dashboardTeacher: '/dashboard/teacher',
    wallet: '/wallet',
    beepoints: '/beepoints',
    chat: '/chat',
    admin: '/admin',
  },
} as const

export type SiteConfig = typeof siteConfig
