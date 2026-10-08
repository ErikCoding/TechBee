import type { ReactNode } from 'react'

// A template (unlike a layout) re-mounts on every navigation, which replays
// the entry animation for each of the three booking steps.
export default function BookTemplate({ children }: { children: ReactNode }) {
  return <div className="booking-step-enter">{children}</div>
}
