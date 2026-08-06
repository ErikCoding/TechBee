import Link from 'next/link'
import {
  Cpu, Settings2, LayoutPanelLeft, Bot, CircuitBoard, Monitor, Zap, Droplets
} from 'lucide-react'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'

const iconMap: Record<string, React.ElementType> = {
  Cpu,
  Settings2,
  LayoutPanelLeft,
  Bot,
  CircuitBoard,
  Monitor,
  Zap,
  Droplets,
}

interface CategoryCardProps {
  category: Category
  className?: string
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  const Icon = iconMap[category.icon] ?? Cpu
  return (
    <Link
      href={`/marketplace?category=${category.id}`}
      className={cn(
        'group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-[#F4B400]/40',
        className,
      )}
    >
      {/* Icon */}
      <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl', category.colorClass)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      {/* Text */}
      <div>
        <h3 className="font-semibold text-foreground group-hover:text-[#F4B400] transition-colors">
          {category.name}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p>
      </div>
      {/* Stats */}
      <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span>{category.teacherCount} nauczycieli</span>
        <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground" aria-hidden="true" />
        <span>{category.lessonCount.toLocaleString()} lekcji</span>
      </div>
    </Link>
  )
}
