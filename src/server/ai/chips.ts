import type { IntentChip, SearchIntent } from '@/lib/domain/search'
import { formatPriceBand, pluralize } from '@/lib/format'
import {
  applicationLabel,
  getSpecDefinition,
  industryLabel,
  specEnumLabel,
} from '@/server/catalog/spec-registry'
import { CATEGORY_BY_KEY, BRAND_BY_KEY } from '@/server/seed/taxonomy'

/**
 * Renders a `SearchIntent` as editable chips.
 *
 * This is the feature that makes an AI search correctable rather than a black
 * box: the buyer can see exactly what was understood, and remove the part that
 * is wrong instead of rewriting the whole sentence and hoping.
 *
 * Chip ids are stable and structured (`spec:material:stainless_steel`) so the
 * remove handler can reverse one specific inference.
 */
export function intentToChips(intent: SearchIntent): IntentChip[] {
  const chips: IntentChip[] = []
  const confidence = intent.confidence

  for (const key of intent.categoryKeys) {
    chips.push({
      id: `category:${key}`,
      kind: 'category',
      label: CATEGORY_BY_KEY.get(key)?.name ?? key,
      qualifier: 'Category',
      removable: true,
      confidence,
    })
  }

  for (const key of intent.brandKeys) {
    chips.push({
      id: `brand:${key}`,
      kind: 'brand',
      label: BRAND_BY_KEY.get(key)?.name ?? key,
      qualifier: 'Brand',
      removable: true,
      confidence,
    })
  }

  for (const constraint of intent.specs) {
    const definition = getSpecDefinition(constraint.key)
    const qualifier = definition?.label ?? constraint.key

    if (constraint.values?.length) {
      for (const value of constraint.values) {
        chips.push({
          id: `spec:${constraint.key}:${value}`,
          kind: 'spec',
          label: specEnumLabel(constraint.key, value),
          qualifier,
          removable: true,
          confidence,
        })
      }
      continue
    }

    const unit = definition?.unit ? ` ${definition.unit}` : ''
    const label =
      constraint.min != null && constraint.max != null
        ? constraint.min === constraint.max
          ? constraint.key === 'size_dn'
            ? `DN${constraint.min}`
            : `${constraint.min}${unit}`
          : `${constraint.min}–${constraint.max}${unit}`
        : constraint.max != null
          ? `up to ${constraint.max}${unit}`
          : `from ${constraint.min}${unit}`

    chips.push({
      id: `spec:${constraint.key}:range`,
      kind: 'spec',
      label,
      qualifier,
      removable: true,
      confidence,
    })
  }

  if (intent.price.min != null || intent.price.max != null) {
    chips.push({
      id: 'price:band',
      kind: 'price',
      label: formatPriceBand(intent.price.min, intent.price.max),
      qualifier: 'Budget',
      removable: true,
      confidence,
    })
  }

  for (const key of intent.applications) {
    chips.push({
      id: `application:${key}`,
      kind: 'application',
      label: applicationLabel(key),
      qualifier: 'Application',
      removable: true,
      confidence,
    })
  }

  for (const key of intent.industries) {
    chips.push({
      id: `industry:${key}`,
      kind: 'application',
      label: industryLabel(key),
      qualifier: 'Sector',
      removable: true,
      confidence,
    })
  }

  if (intent.quantity != null) {
    chips.push({
      id: 'quantity',
      kind: 'quantity',
      label: pluralize(intent.quantity, 'unit'),
      qualifier: 'Quantity',
      removable: true,
      confidence: 1,
    })
  }

  if (intent.requiresInStock) {
    chips.push({
      id: 'availability:in_stock',
      kind: 'availability',
      label: 'Ready stock only',
      qualifier: 'Availability',
      removable: true,
      confidence: 1,
    })
  }

  return chips
}

/**
 * Applies a chip removal back onto the intent.
 *
 * Kept next to the renderer so the id format has exactly one owner — a chip
 * that renders but cannot be removed is worse than no chip at all.
 */
export function removeChip(intent: SearchIntent, chipId: string): SearchIntent {
  const [kind, a, b] = chipId.split(':')

  switch (kind) {
    case 'category':
      return { ...intent, categoryKeys: intent.categoryKeys.filter((key) => key !== a) }
    case 'brand':
      return { ...intent, brandKeys: intent.brandKeys.filter((key) => key !== a) }
    case 'price':
      return { ...intent, price: {} }
    case 'application':
      return { ...intent, applications: intent.applications.filter((key) => key !== a) }
    case 'industry':
      return { ...intent, industries: intent.industries.filter((key) => key !== a) }
    case 'quantity':
      return { ...intent, quantity: null }
    case 'availability':
      return { ...intent, requiresInStock: false }
    case 'spec': {
      if (b === 'range') {
        return { ...intent, specs: intent.specs.filter((constraint) => constraint.key !== a) }
      }
      return {
        ...intent,
        specs: intent.specs
          .map((constraint) =>
            constraint.key === a && constraint.values
              ? { ...constraint, values: constraint.values.filter((value) => value !== b) }
              : constraint
          )
          .filter((constraint) => !constraint.values || constraint.values.length > 0),
      }
    }
    default:
      return intent
  }
}
