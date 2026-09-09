// ─────────────────────────────────────────────────────────────
// Central site configuration. Change values here instead of
// hunting for magic strings across the codebase.
// ─────────────────────────────────────────────────────────────

export const siteConfig = {
  name: 'Runbee',
  legalName: 'Runbee',
  tagline: 'Ucz się praktycznych umiejętności od zweryfikowanych praktyków',
  description:
    'Połącz się ze zweryfikowanymi nauczycielami z różnych dziedzin na indywidualne lekcje online.',
  url: 'https://runbee.pl',
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
