import type { ProductSpec, ProductView } from '@/lib/domain/catalog'
import { SPEC_BY_KEY, specsForCategory } from './spec-registry'

/**
 * Chooses which specifications to surface on a product card.
 *
 * A card has room for three values. Picking them by `rankWeight` means each
 * category shows what actually distinguishes its products — material and size
 * for a valve, current and breaking capacity for a breaker — rather than
 * whichever three happened to be listed first.
 */
export function highlightSpecs(product: ProductView, count = 3): ProductSpec[] {
  const relevant = new Set(specsForCategory(product.category.key).map((d) => d.key))

  // A card chip is a value with no label, so two specs that render the same
  // text ("10 bar" for range and for rating) read as a stutter, and a
  // placeholder value says nothing. Both give the slot to the next spec.
  const seen = new Set<string>()

  return [...product.specs]
    .filter((spec) => relevant.has(spec.key))
    .sort((a, b) => {
      const weightA = SPEC_BY_KEY.get(a.key)?.rankWeight ?? 0
      const weightB = SPEC_BY_KEY.get(b.key)?.rankWeight ?? 0
      return weightB - weightA || a.key.localeCompare(b.key)
    })
    .filter((spec) => {
      const value = spec.displayValue.trim()
      if (!value || value === '—' || value.toUpperCase() === 'N/A') return false
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
    .slice(0, count)
}

/**
 * Specs grouped for the detail page and the comparison grid, in the display
 * order declared by `SPEC_GROUPS`.
 */
export function groupedSpecs(product: ProductView): { group: string; label: string; specs: ProductSpec[] }[] {
  const GROUP_LABELS: Record<string, string> = {
    construction: 'Construction',
    dimensions: 'Dimensions',
    performance: 'Performance',
    electrical: 'Electrical',
    connection: 'Connection',
    compliance: 'Compliance',
    commercial: 'Commercial',
  }

  const byGroup = new Map<string, ProductSpec[]>()

  for (const spec of product.specs) {
    const definition = SPEC_BY_KEY.get(spec.key)
    const group = definition?.group ?? 'construction'
    const existing = byGroup.get(group) ?? []
    existing.push(spec)
    byGroup.set(group, existing)
  }

  return [...byGroup.entries()]
    .map(([group, specs]) => ({
      group,
      label: GROUP_LABELS[group] ?? group,
      specs: specs.sort((a, b) => {
        const weightA = SPEC_BY_KEY.get(a.key)?.rankWeight ?? 0
        const weightB = SPEC_BY_KEY.get(b.key)?.rankWeight ?? 0
        return weightB - weightA
      }),
    }))
    .sort((a, b) => {
      const order = ['construction', 'connection', 'dimensions', 'performance', 'electrical', 'compliance', 'commercial']
      return order.indexOf(a.group) - order.indexOf(b.group)
    })
}

/** Human label for a spec key, for use outside the registry module. */
export function specLabel(key: string): string {
  return SPEC_BY_KEY.get(key)?.label ?? key
}
