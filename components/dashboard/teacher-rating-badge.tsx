'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getTeacherDashboard } from '@/services/lessons.service'

interface Props {
  initialRating: number
  initialReviewCount: number
}

/**
 * Rating/review-count pill in the dashboard header. Starts from the
 * server-fetched demo baseline and re-fetches from the signed-in
 * teacher's own Firestore application doc once known client-side —
 * the shared mock dataset's rating belongs to a fictional teacher,
 * not whoever is actually logged in.
 */
export function TeacherRatingBadge({ initialRating, initialReviewCount }: Props) {
  const { user } = useAuth()
  const [rating, setRating] = useState(initialRating)
  const [reviewCount, setReviewCount] = useState(initialReviewCount)

  useEffect(() => {
    if (!user || user.role !== 'teacher') return
    let cancelled = false
    getTeacherDashboard(user.name, user.id).then((fresh) => {
      if (!cancelled) {
        setRating(fresh.rating)
        setReviewCount(fresh.reviewCount)
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="flex items-center gap-1 rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-semibold text-[#78350F] dark:bg-[#3B2800] dark:text-[#FBBF24]">
      <Star className="h-3 w-3 fill-[#B45309] dark:fill-[#FBBF24] stroke-none" aria-hidden="true" />
      {rating.toFixed(1)} · {reviewCount} opinii
    </div>
  )
}
