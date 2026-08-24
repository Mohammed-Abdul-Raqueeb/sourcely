import 'server-only'
import type { ProductView } from '@/lib/domain/catalog'
import type { CompareRow } from '@/components/catalog/comparison-grid'
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_STATES_ORDER,
  formatLeadTime,
  formatPrice,
  formatWarranty,
} from '@/lib/format'
import { applicationLabel, SPEC_BY_KEY, SPEC_DEFINITIONS } from './spec-registry'

/**
 * Builds the comparison grid.
 *
 * Two decisions worth naming:
 *
 * **A row is included if *any* product publishes it.** Dropping rows that one
 * product is missing would hide exactly the thing a buyer is comparing on — a
 * gap in a datasheet is information, and it renders as a dash rather than
 * disappearing.
 *
 * **`bestIndex` is only set where "best" is unambiguous.** Lowest price,
 * longest warranty, shortest lead time, readiest stock, highest rating. A
 * higher pressure rating is not automatically better — it usually costs more
 * and may not be specified — so numeric specs are left unmarked rather than
 * given a winner the data does not support.
 */

/** Ranks availability states so "readiest" has a defined meaning. */
function availabilityRank(product: ProductView): number {
  return AVAILABILITY_STATES_ORDER.indexOf(product.availability.state)
}

function indexOfMin(values: (number | null)[]): number | null {
  let bestIndex: number | null = null
  let best = Number.POSITIVE_INFINITY
  values.forEach((value, index) => {
    if (value == null) return
    if (value < best) {
      best = value
      bestIndex = index
    }
  })
  // A tie is not a winner — marking one of two identical values misleads.
  const ties = values.filter((value) => value != null && value === best).length
  return ties > 1 ? null : bestIndex
}

function indexOfMax(values: (number | null)[]): number | null {
  let bestIndex: number | null = null
  let best = Number.NEGATIVE_INFINITY
  values.forEach((value, index) => {
    if (value == null) return
    if (value > best) {
      best = value
      bestIndex = index
    }
  })
  const ties = values.filter((value) => value != null && value === best).length
  return ties > 1 ? null : bestIndex
}

function allSame(values: (string | null)[]): boolean {
  const first = values[0] ?? null
  return values.every((value) => value === first)
}

export function buildComparisonRows(products: ProductView[]): CompareRow[] {
  const rows: CompareRow[] = []

  const push = (
    key: string,
    label: string,
    group: string,
    values: (string | null)[],
    bestIndex: number | null = null,
    unit?: string
  ) => {
    rows.push({ key, label, group, values, bestIndex, identical: allSame(values), unit })
  }

  /* --- Commercial ------------------------------------------------------- */

  push(
    'price',
    'Price',
    'Commercial',
    products.map((product) => formatPrice(product.price)),
    indexOfMin(products.map((product) => product.price))
  )

  push(
    'price_unit',
    'Priced',
    'Commercial',
    products.map((product) => product.priceUnit)
  )

  push(
    'availability',
    'Availability',
    'Commercial',
    products.map((product) => AVAILABILITY_LABELS[product.availability.state]),
    indexOfMax(products.map(availabilityRank))
  )

  push(
    'lead_time',
    'Lead time',
    'Commercial',
    products.map((product) => formatLeadTime(product.availability.leadTimeDays)),
    indexOfMin(products.map((product) => product.availability.leadTimeDays ?? 0))
  )

  push(
    'moq',
    'Minimum order',
    'Commercial',
    products.map(
      (product) => `${product.availability.minOrderQuantity} ${product.availability.unit}`
    ),
    indexOfMin(products.map((product) => product.availability.minOrderQuantity))
  )

  push(
    'warranty',
    'Warranty',
    'Commercial',
    products.map((product) => formatWarranty(product.warrantyMonths)),
    indexOfMax(products.map((product) => product.warrantyMonths ?? 0))
  )

  push(
    'rating',
    'Buyer rating',
    'Commercial',
    products.map((product) =>
      product.rating ? `${product.rating.average.toFixed(1)} (${product.rating.count})` : null
    ),
    indexOfMax(products.map((product) => product.rating?.average ?? null))
  )

  /* --- Supplier --------------------------------------------------------- */

  push('brand', 'Brand', 'Supplier', products.map((product) => product.brand.name))
  push('origin', 'Country of origin', 'Supplier', products.map((product) => product.brand.country))
  push('seller', 'Seller', 'Supplier', products.map((product) => product.seller.name))
  push(
    'seller_city',
    'Ships from',
    'Supplier',
    products.map((product) => `${product.seller.city}, ${product.seller.state}`)
  )
  push(
    'fulfilment',
    'Fulfilment rate',
    'Supplier',
    products.map((product) => `${Math.round(product.seller.fulfilmentRate * 100)}%`),
    indexOfMax(products.map((product) => product.seller.fulfilmentRate))
  )
  push(
    'response',
    'Quote response',
    'Supplier',
    products.map((product) => `~${product.seller.responseHours} h`),
    indexOfMin(products.map((product) => product.seller.responseHours))
  )

  /* --- Specifications --------------------------------------------------- */

  // Every comparable spec any of these products publishes, in registry order
  // so the grid reads the same way as the product detail page.
  const present = new Set(
    products.flatMap((product) => product.specs.map((spec) => spec.key))
  )

  const GROUP_LABELS: Record<string, string> = {
    construction: 'Construction',
    connection: 'Connection',
    dimensions: 'Dimensions',
    performance: 'Performance',
    electrical: 'Electrical',
    compliance: 'Compliance',
    commercial: 'Commercial detail',
  }

  for (const definition of SPEC_DEFINITIONS) {
    if (!definition.isComparable || !present.has(definition.key)) continue

    push(
      definition.key,
      definition.label,
      GROUP_LABELS[definition.group] ?? 'Specification',
      products.map(
        (product) =>
          product.specs.find((spec) => spec.key === definition.key)?.displayValue ?? null
      ),
      // Deliberately no winner: a bigger number is not a better product.
      null,
      undefined
    )
  }

  /* --- Compliance & fit --------------------------------------------------- */

  push(
    'applications',
    'Documented for',
    'Compliance',
    products.map((product) =>
      product.applications.length > 0
        ? product.applications.map(applicationLabel).join(', ')
        : null
    )
  )

  push(
    'certifications',
    'Standards',
    'Compliance',
    products.map((product) =>
      product.certifications.length > 0 ? product.certifications.join(', ') : null
    ),
    indexOfMax(products.map((product) => product.certifications.length))
  )

  push(
    'documents',
    'Documents',
    'Compliance',
    products.map((product) => `${product.documents.length} available`)
  )

  return rows
}

/** Human label for a spec key. Re-exported so pages need one import. */
export function comparisonSpecLabel(key: string): string {
  return SPEC_BY_KEY.get(key)?.label ?? key
}
