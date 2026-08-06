import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BeeLogoProps {
  className?: string
  iconOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function BeeLogo({ className, iconOnly = false, size = 'md' }: BeeLogoProps) {
  const sizes = {
    sm: { icon: 24, text: 'text-lg' },
    md: { icon: 30, text: 'text-xl' },
    lg: { icon: 38, text: 'text-2xl' },
  }
  const s = sizes[size]

  return (
    <Link href="/" className={cn('flex items-center gap-2 select-none', className)}>
      {/* Minimalist hex bee icon */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Hexagon body */}
        <path
          d="M18 2L32.6 10.5V27.5L18 36L3.4 27.5V10.5L18 2Z"
          fill="#F4B400"
        />
        {/* Stripes */}
        <rect x="8" y="14" width="20" height="3.5" rx="1.75" fill="#0A0A0A" opacity="0.25" />
        <rect x="8" y="19" width="20" height="3.5" rx="1.75" fill="#0A0A0A" opacity="0.25" />
        {/* Wings */}
        <ellipse cx="9" cy="11" rx="5" ry="3" fill="white" opacity="0.65" transform="rotate(-20 9 11)" />
        <ellipse cx="27" cy="11" rx="5" ry="3" fill="white" opacity="0.65" transform="rotate(20 27 11)" />
        {/* Eye */}
        <circle cx="18" cy="24" r="2" fill="#0A0A0A" opacity="0.5" />
      </svg>
      {!iconOnly && (
        <span className={cn('font-bold tracking-tight', s.text)}>
          <span className="text-foreground">Tech</span>
          <span style={{ color: '#F4B400' }}>Bee</span>
        </span>
      )}
    </Link>
  )
}
