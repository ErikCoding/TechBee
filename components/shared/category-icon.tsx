import { Cpu, Settings2, LayoutPanelLeft, Bot, CircuitBoard, Monitor, Zap, Droplets } from 'lucide-react'

/**
 * Maps a `Category.icon` string from the catalogue onto a lucide icon.
 *
 * The map used to live inside the category card component, so any other
 * surface wanting a category icon — the homepage discovery list, the
 * marketplace filter rail — had to import that whole card or duplicate
 * the lookup. Extracted so the icon vocabulary has one home and an
 * unrecognised value degrades to the same fallback everywhere.
 */
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

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] ?? Cpu
  return <Icon className={className} aria-hidden="true" />
}
