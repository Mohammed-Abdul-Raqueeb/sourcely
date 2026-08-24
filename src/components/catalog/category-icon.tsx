import {
  CircleGauge,
  Droplets,
  Factory,
  Flame,
  Gauge,
  HardHat,
  Package,
  Waves,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Category icon resolution.
 *
 * An explicit whitelist, never a dynamic lookup by string. Two reasons: a
 * dynamic import defeats tree-shaking and pulls the entire icon set into the
 * bundle, and category data becoming able to select arbitrary code is not a
 * property worth having.
 */
const ICONS: Record<string, LucideIcon> = {
  Waves,
  Wind,
  Gauge,
  Zap,
  Flame,
  Droplets,
  CircleGauge,
  Factory,
  Wrench,
  HardHat,
}

export function CategoryIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Icon = ICONS[name] ?? Package
  return <Icon className={cn('size-5', className)} aria-hidden />
}
