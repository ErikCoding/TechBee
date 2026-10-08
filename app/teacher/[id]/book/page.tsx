import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Old single-page URL (Stripe cancel_url, dashboard links, bookmarks) →
// first step, keeping ?bookingForId / ?bookingForName.
export default async function BookIndexPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const key of ['bookingForId', 'bookingForName'] as const) {
    const value = sp[key]
    if (typeof value === 'string' && value) qs.set(key, value)
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/teacher/${encodeURIComponent(id)}/book/termin${suffix}`)
}
