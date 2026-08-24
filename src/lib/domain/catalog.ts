/**
 * Catalog domain contracts.
 *
 * Pure types only — no runtime dependencies, no server imports. Both the
 * browser bundle and the server import from here, which is what keeps the
 * repository drivers (memory / prisma) interchangeable behind one shape.
 *
 * Money convention: `price` is a whole-rupee integer. Industrial catalogue
 * prices are quoted in rupees, never paise, and integer arithmetic keeps
 * range filters and band scoring exact.
 */

export type Currency = 'INR'

export type ProductStatus = 'active' | 'draft' | 'archived'

/** Ordered worst → best. Availability scoring relies on this ordering. */
export const AVAILABILITY_STATES = [
  'out_of_stock',
  'made_to_order',
  'low_stock',
  'in_stock',
] as const

export type AvailabilityState = (typeof AVAILABILITY_STATES)[number]

export interface Availability {
  state: AvailabilityState
  /** null when the seller does not publish stock counts. */
  quantityOnHand: number | null
  /** Dispatch lead time in days; null when ex-stock. */
  leadTimeDays: number | null
  minOrderQuantity: number
  /** Unit of sale, e.g. 'unit', 'metre', 'set of 4'. */
  unit: string
}

/* -------------------------------------------------------------------------- */
/* Specifications                                                             */
/* -------------------------------------------------------------------------- */

export type SpecDataType = 'enum' | 'text' | 'number' | 'boolean'

/**
 * Specs are grouped for presentation. The order of this list is the order
 * they render in on the product detail page and the comparison grid.
 */
export const SPEC_GROUPS = [
  'construction',
  'dimensions',
  'performance',
  'electrical',
  'connection',
  'compliance',
  'commercial',
] as const

export type SpecGroup = (typeof SPEC_GROUPS)[number]

export interface SpecEnumValue {
  /** Canonical machine value, e.g. `stainless_steel`. */
  value: string
  /** Human label, e.g. `Stainless Steel (SS316)`. */
  label: string
  /**
   * Terms that resolve to this value during offline intent parsing.
   * This list is the reason the assistant works with no LLM configured.
   */
  synonyms: string[]
  /**
   * Values a buyer asking for this one would likely accept. Drives the
   * 0.6 partial-credit path in spec scoring — a buyer who asks for SS316
   * is usually not offended by SS304, but is by cast iron.
   */
  compatibleWith?: string[]
}

export interface SpecDefinition {
  key: string
  label: string
  dataType: SpecDataType
  group: SpecGroup
  /** Display unit, e.g. `mm`, `bar`, `kA`, `m3/h`. */
  unit?: string
  enumValues?: SpecEnumValue[]
  /** Appears in listing-page facets. */
  isFilterable: boolean
  /** Appears in the comparison grid. */
  isComparable: boolean
  /**
   * When absent from a query, this spec is a candidate for the assistant's
   * single follow-up question.
   */
  isCritical: boolean
  /** 0..1 — relative importance inside the specMatch score component. */
  rankWeight: number
  /** Category keys this applies to. Empty array means it applies globally. */
  categoryKeys: string[]
  /** Short buyer-facing explanation, shown in the spec table tooltip. */
  hint?: string
}

export interface ProductSpec {
  key: string
  valueText?: string
  valueNumber?: number
  valueBool?: boolean
  unit?: string
  /** Pre-rendered for display, e.g. `DN50 (2")`. Never parsed. */
  displayValue: string
}

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                   */
/* -------------------------------------------------------------------------- */

export interface Category {
  id: string
  key: string
  slug: string
  name: string
  /** null for a top-level category. */
  parentId: string | null
  description: string
  /** lucide-react icon name, resolved through a whitelist map. */
  icon: string
  /** Denormalised for listing pages; refreshed on write. */
  productCount: number
  featured: boolean
  sortOrder: number
}

export interface Brand {
  id: string
  key: string
  slug: string
  name: string
  country: string
  description: string
  /** Denormalised. */
  productCount: number
}

export interface Seller {
  id: string
  key: string
  name: string
  city: string
  state: string
  /** GST registration — B2B buyers filter on this. */
  gstin: string
  verified: boolean
  /** 0..1 — feeds the sellerTrust score component. */
  fulfilmentRate: number
  /** Median first-response time on RFQs, in hours. */
  responseHours: number
  since: number
}

/* -------------------------------------------------------------------------- */
/* Product                                                                    */
/* -------------------------------------------------------------------------- */

export interface ProductImage {
  url: string
  alt: string
  /** Intrinsic dimensions — required, so no layout shift is possible. */
  width: number
  height: number
  /** Tiny base64 LQIP, or null to fall back to a token-coloured placeholder. */
  blurDataUrl?: string | null
}

export type DocumentKind = 'datasheet' | 'certificate' | 'manual' | 'cad' | 'warranty'

export interface ProductDocument {
  id: string
  kind: DocumentKind
  title: string
  url: string
  sizeKb: number
  /** e.g. `PDF`, `DWG`. */
  format: string
}

export interface ProductRating {
  average: number
  count: number
}

export interface ProductMetrics {
  views: number
  rfqs: number
  saves: number
}

export interface Product {
  id: string
  slug: string
  sku: string
  name: string
  /** One line. Used on cards and in search results. */
  shortDescription: string
  /** Full prose. Rendered as text — never as HTML. */
  description: string

  categoryId: string
  subcategoryId: string | null
  brandId: string
  sellerId: string

  price: number
  /** MRP, when the seller publishes a discount. */
  listPrice: number | null
  currency: Currency
  /** e.g. `per unit`, `per metre`, `per set`. */
  priceUnit: string
  taxRatePercent: number

  status: ProductStatus
  availability: Availability

  images: ProductImage[]
  specs: ProductSpec[]

  /** Canonical application keys, e.g. `hvac`, `fire_fighting`. */
  applications: string[]
  industries: string[]
  tags: string[]

  documents: ProductDocument[]
  warrantyMonths: number | null
  certifications: string[]
  relatedProductIds: string[]

  rating: ProductRating | null
  metrics: ProductMetrics

  createdAt: string
  updatedAt: string
}

/**
 * A product with its taxonomy joined. Repositories return this for any view
 * that renders a card or a detail page, so the UI never issues follow-up
 * lookups for a brand name.
 */
export interface ProductView extends Product {
  category: Category
  subcategory: Category | null
  brand: Brand
  seller: Seller
}

/* -------------------------------------------------------------------------- */
/* Applications & industries                                                  */
/* -------------------------------------------------------------------------- */

export interface ApplicationDefinition {
  key: string
  label: string
  synonyms: string[]
}
