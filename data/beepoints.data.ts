import type { BeePointsEvent, BeePointsRule, BeePointsStats, BeePointsTier } from '@/lib/types'

// Mock data — will be swapped for Firestore `beepoints/{uid}` doc + `events` subcollection.
export const beePointsTiersData: BeePointsTier[] = [
  {
    name: 'Zwiadowca',
    icon: 'Sprout',
    minPoints: 0,
    maxPoints: 999,
    colorClass: 'text-zinc-500',
    badgeClass: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    benefits: ['5% zniżki na pierwszą rezerwację', 'Dostęp do forum społeczności', 'Miesięczny newsletter'],
  },
  {
    name: 'Robotnica',
    icon: 'Award',
    minPoints: 1000,
    maxPoints: 2999,
    colorClass: 'text-amber-600',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    benefits: ['10% zniżki na lekcje', 'Priorytetowe rezerwacje', 'Dostęp do nagranych webinarów', 'Miesięczny newsletter'],
  },
  {
    name: 'Truteń',
    icon: 'Star',
    minPoints: 3000,
    maxPoints: 7999,
    colorClass: 'text-primary',
    badgeClass: 'bg-bee-yellow-light text-bee-yellow-dark dark:bg-bee-yellow-light dark:text-primary-foreground',
    benefits: ['15% zniżki na lekcje', 'Darmowa lekcja co 10 sesji', 'Dedykowane wsparcie', 'Wczesny dostęp do nowych nauczycieli', 'Ekskluzywne webinary'],
  },
  {
    name: 'Królowa',
    icon: 'Crown',
    minPoints: 8000,
    maxPoints: Infinity,
    colorClass: 'text-cyan-500',
    badgeClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    benefits: ['20% zniżki na wszystkie lekcje', 'Darmowa lekcja co 5 sesji', 'Osobisty doradca nauki', 'Ekskluzywne masterclassy', 'Współbrandowane certyfikaty', 'Priorytetowe rozwiązywanie sporów'],
  },
]

export const beePointsEventsData: BeePointsEvent[] = [
  { id: 'bp1', description: 'Ukończona lekcja z Markiem Kowalskim', points: 180, date: '25 lip 2026', type: 'earned' },
  { id: 'bp2', description: 'Dodano opinię 5-gwiazdkową', points: 100, date: '25 lip 2026', type: 'earned' },
  { id: 'bp3', description: 'Wymieniono: 50 zł kredytu na lekcje', points: -500, date: '15 lip 2026', type: 'redeemed' },
  { id: 'bp4', description: 'Ukończona lekcja z Krzysztofem Zielińskim', points: 150, date: '22 lip 2026', type: 'earned' },
  { id: 'bp5', description: 'Bonus za tygodniową serię (7 dni)', points: 250, date: '21 lip 2026', type: 'earned' },
  { id: 'bp6', description: 'Ukończona lekcja z Julią Kamińską', points: 300, date: '18 lip 2026', type: 'earned' },
  { id: 'bp7', description: 'Polecono znajomego (Łukasz F.)', points: 500, date: '12 lip 2026', type: 'earned' },
  { id: 'bp8', description: 'Wymieniono: kupon 15% zniżki', points: -300, date: '30 cze 2026', type: 'redeemed' },
  { id: 'bp9', description: 'Ukończona lekcja z Anną Wiśniewską', points: 160, date: '28 cze 2026', type: 'earned' },
  { id: 'bp10', description: 'Bonus za uzupełnienie profilu', points: 200, date: '20 cze 2026', type: 'earned' },
]

export const beePointsStatsData: BeePointsStats = {
  currentPoints: 2840,
  lifetimePoints: 3640,
  currentTier: 'Robotnica',
  nextTier: 'Truteń',
  pointsToNextTier: 160,
}

// ─────────────────────────────────────────────
// Program rules — the copy shown on the "Jak działają BeePoints"
// section. Kept as data (not hard-coded JSX) so the numbers here and
// the ones used to compute `beePointsEventsData` above stay in sync:
// 1 zł spent on a completed lesson = 1 BeePoint, 10 BeePoints = 1 zł
// of lesson credit.
// ─────────────────────────────────────────────

export const beePointsEarningRulesData: BeePointsRule[] = [
  {
    icon: 'GraduationCap',
    title: 'Ukończona lekcja',
    points: '+1 pkt / 1 zł',
    description: 'Za każdą ukończoną (nieodwołaną) lekcję dostajesz tyle BeePoints, ile zapłaciłeś w złotówkach — lekcja za 180 zł to +180 pkt.',
  },
  {
    icon: 'Star',
    title: 'Opinia po lekcji',
    points: '+100 pkt',
    description: 'Za każdą dodaną opinię o nauczycielu, niezależnie od oceny.',
  },
  {
    icon: 'Sparkles',
    title: 'Pierwsza lekcja',
    points: '+150 pkt',
    description: 'Jednorazowy bonus powitalny za Twoją pierwszą zarezerwowaną i ukończoną lekcję na Runbee.',
  },
  {
    icon: 'UserCheck',
    title: 'Uzupełniony profil',
    points: '+200 pkt',
    description: 'Jednorazowo, gdy dodasz zdjęcie profilowe i uzupełnisz opis swoich celów nauki.',
  },
  {
    icon: 'Flame',
    title: 'Seria nauki',
    points: '+250 pkt / 7 dni',
    description: 'Za każde 7 kolejnych dni z aktywnością (lekcja, wiadomość lub logowanie) na koncie.',
  },
  {
    icon: 'Users',
    title: 'Polecenie znajomego',
    points: '+500 pkt',
    description: 'Gdy osoba zaproszona Twoim linkiem zarejestruje się i ukończy swoją pierwszą lekcję.',
  },
]

export const beePointsRedemptionRulesData: BeePointsRule[] = [
  {
    icon: 'Wallet',
    title: 'Kredyt na lekcje',
    points: '10 pkt = 1 zł',
    description: 'Wymieniaj punkty na saldo portfela w dowolnym momencie — np. 500 pkt to 50 zł kredytu na kolejną lekcję.',
  },
  {
    icon: 'Ticket',
    title: 'Kupon zniżkowy 15%',
    points: '300 pkt',
    description: 'Jednorazowy kupon na 15% zniżki, do wykorzystania na dowolnej lekcji w ciągu 30 dni.',
  },
  {
    icon: 'Gift',
    title: 'Darmowa lekcja',
    points: 'Automatycznie',
    description: 'Od poziomu Truteń: darmowa lekcja co 10 ukończonych sesji. Od poziomu Królowa: co 5 sesji — bez wymiany punktów.',
  },
  {
    icon: 'Crown',
    title: 'Zniżka stała wg poziomu',
    points: 'Automatycznie',
    description: 'Każdy poziom daje stałą zniżkę na wszystkie lekcje (5–20%), naliczaną automatycznie przy płatności — punkty zostają nietknięte.',
  },
]
