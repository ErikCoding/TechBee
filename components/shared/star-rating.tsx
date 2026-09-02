import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  max?: number
  className?: string
  size?: 'sm' | 'md'
}

export function StarRating({ rating, max = 5, className, size = 'sm' }: StarRatingProps) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`Ocena: ${rating} na ${max}`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(rating)
        const partial = !filled && i < rating
        return (
          <Star
            key={i}
            className={cn(
              sizeClass,
              filled
                ? 'fill-primary stroke-none'
                : partial
                ? 'fill-primary/40 stroke-none'
                : 'fill-muted stroke-none',
            )}
            aria-hidden="true"
          />
        )
      })}
    </div>
  )
}
