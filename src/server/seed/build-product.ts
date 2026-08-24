import type {
  Availability,
  AvailabilityState,
  Product,
  ProductDocument,
  ProductImage,
  ProductSpec,
} from '@/lib/domain/catalog'
import { SPEC_BY_KEY } from '@/server/catalog/spec-registry'
import { PRODUCT_IMAGE_MANIFEST } from './product-images'
import { BRAND_BY_KEY, CATEGORY_BY_KEY, SELLER_BY_KEY } from './taxonomy'

/**
 * Expands a compact seed record into a full `Product`.
 *
 * Product data is written by hand for realism, but everything derivable —
 * slug, display strings, image descriptors, timestamps, metrics — is generated
 * here so the seed files stay readable and stay consistent with each other.
 *
 * Everything random is derived from a hash of the SKU, so the catalogue is
 * byte-identical on every boot. Non-deterministic seed data would produce
 * hydration mismatches and unrepeatable search rankings.
 */

/* -------------------------------------------------------------------------- */
/* Deterministic pseudo-randomness                                            */
/* -------------------------------------------------------------------------- */

/** FNV-1a. Small, fast, and stable across Node versions. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic value in [min, max], keyed by seed string. */
function pick(seed: string, min: number, max: number): number {
  const n = hash(seed) / 0xffffffff
  return Math.round(min + n * (max - min))
}

/** The catalogue's reference "now". Fixed so timestamps never drift. */
const REFERENCE_EPOCH = Date.UTC(2026, 7, 1) // 2026-08-01

function isoDaysAgo(days: number): string {
  return new Date(REFERENCE_EPOCH - days * 86_400_000).toISOString()
}

/* -------------------------------------------------------------------------- */
/* Spec rendering                                                             */
/* -------------------------------------------------------------------------- */

/** Nominal bore to imperial, for the sizes that actually appear in trade. */
const DN_TO_INCH: Record<number, string> = {
  15: '1/2"',
  20: '3/4"',
  25: '1"',
  32: '1-1/4"',
  40: '1-1/2"',
  50: '2"',
  65: '2-1/2"',
  80: '3"',
  100: '4"',
  125: '5"',
  150: '6"',
  200: '8"',
  250: '10"',
  300: '12"',
}

export type SpecInput = string | number | boolean

/**
 * Turns `{ material: 'stainless_steel', size_dn: 50 }` into fully rendered
 * `ProductSpec` rows. An unknown key throws — a typo in seed data should fail
 * loudly at boot, not silently produce an unfilterable product.
 */
function buildSpecs(sku: string, input: Record<string, SpecInput>): ProductSpec[] {
  const specs: ProductSpec[] = []

  for (const [key, raw] of Object.entries(input)) {
    const definition = SPEC_BY_KEY.get(key)
    if (!definition) {
      throw new Error(`[seed] ${sku}: unknown spec key "${key}" — add it to spec-registry.ts`)
    }

    switch (definition.dataType) {
      case 'enum': {
        const value = String(raw)
        const option = definition.enumValues?.find((o) => o.value === value)
        if (!option) {
          throw new Error(
            `[seed] ${sku}: "${value}" is not a valid value for spec "${key}". ` +
              `Valid: ${definition.enumValues?.map((o) => o.value).join(', ')}`
          )
        }
        specs.push({ key, valueText: value, displayValue: option.label })
        break
      }

      case 'number': {
        const value = Number(raw)
        let displayValue: string
        if (key === 'size_dn') {
          const inch = DN_TO_INCH[value]
          displayValue = inch ? `DN${value} (${inch})` : `DN${value}`
        } else if (definition.unit) {
          displayValue = `${value} ${definition.unit}`
        } else {
          displayValue = String(value)
        }
        specs.push({ key, valueNumber: value, unit: definition.unit, displayValue })
        break
      }

      case 'boolean': {
        const value = Boolean(raw)
        specs.push({ key, valueBool: value, displayValue: value ? 'Yes' : 'No' })
        break
      }

      default: {
        const value = String(raw)
        specs.push({ key, valueText: value, displayValue: value })
      }
    }
  }

  return specs
}

/* -------------------------------------------------------------------------- */
/* Imagery                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Generated studio renders come first: scripts/generate-product-images.ts
 * rasterizes every seeded product into public/products/ and records the
 * result in the PRODUCT_IMAGE_MANIFEST, which is looked up here by SKU.
 * `<ProductMedia />` serves these through `next/image` like any photograph.
 *
 * The `artwork:` descriptor scheme remains the fallback for products with no
 * generated imagery (e.g. admin-created ones): it resolves to the vector
 * technical illustration in `<ProductArtwork />`, exactly as before.
 */
function buildImages(sku: string, artwork: string, name: string): ProductImage[] {
  const generated = PRODUCT_IMAGE_MANIFEST[sku]
  if (generated && generated.length > 0) {
    return generated.map((image) => ({
      url: image.url,
      alt: image.alt,
      width: image.width,
      height: image.height,
      blurDataUrl: image.blurDataUrl,
    }))
  }

  const views = ['front', 'section', 'detail', 'scale'] as const
  return views.map((view) => ({
    url: `artwork:${artwork}:${view}:${hash(sku + view) % 1000}`,
    alt: `${name} — ${view} view`,
    width: 1200,
    height: 900,
    blurDataUrl: null,
  }))
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

function buildDocuments(sku: string, name: string, certifications: string[]): ProductDocument[] {
  const documents: ProductDocument[] = [
    {
      id: `doc_${sku}_ds`,
      kind: 'datasheet',
      title: `${name} — Technical Datasheet`,
      url: `/documents/${sku.toLowerCase()}-datasheet.pdf`,
      sizeKb: pick(`${sku}ds`, 180, 940),
      format: 'PDF',
    },
  ]

  if (certifications.length > 0) {
    documents.push({
      id: `doc_${sku}_cert`,
      kind: 'certificate',
      title: `Conformity Certificate — ${certifications.join(', ')}`,
      url: `/documents/${sku.toLowerCase()}-certificate.pdf`,
      sizeKb: pick(`${sku}cert`, 90, 420),
      format: 'PDF',
    })
  }

  documents.push({
    id: `doc_${sku}_iom`,
    kind: 'manual',
    title: `${name} — Installation & Maintenance`,
    url: `/documents/${sku.toLowerCase()}-iom.pdf`,
    sizeKb: pick(`${sku}iom`, 320, 1800),
    format: 'PDF',
  })

  return documents
}

/* -------------------------------------------------------------------------- */
/* Seed record                                                                */
/* -------------------------------------------------------------------------- */

export interface ProductSeed {
  sku: string
  name: string
  /** Category key from taxonomy.ts. */
  category: string
  /** Subcategory key. */
  subcategory: string
  /** Brand key. */
  brand: string
  /** Seller key. */
  seller: string
  price: number
  /** MRP, when the seller publishes a discount. */
  listPrice?: number
  priceUnit?: string
  short: string
  description: string
  specs: Record<string, SpecInput>
  applications: string[]
  industries?: string[]
  tags: string[]
  availability?: AvailabilityState
  stock?: number
  leadTimeDays?: number
  moq?: number
  unit?: string
  warrantyMonths?: number
  certifications?: string[]
  /** Illustration key for `<ProductMedia />`. */
  artwork: string
  /** SKUs of related products. Resolved to ids after all seeds are built. */
  related?: string[]
  /** Overrides the derived rating, as [average, count]. */
  rating?: [number, number]
  /** Marks a product as a homepage / category hero. Boosts nothing in search. */
  featured?: boolean
}

function slugify(name: string, sku: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 68)
  return `${base}-${sku.toLowerCase()}`
}

function buildAvailability(seed: ProductSeed): Availability {
  const state: AvailabilityState = seed.availability ?? 'in_stock'
  const stock =
    seed.stock ??
    (state === 'in_stock'
      ? pick(`${seed.sku}stock`, 24, 480)
      : state === 'low_stock'
        ? pick(`${seed.sku}stock`, 2, 11)
        : 0)

  const leadTimeDays =
    seed.leadTimeDays ??
    (state === 'in_stock'
      ? 1
      : state === 'low_stock'
        ? 3
        : state === 'made_to_order'
          ? pick(`${seed.sku}lead`, 14, 45)
          : null)

  return {
    state,
    quantityOnHand: state === 'made_to_order' ? null : stock,
    leadTimeDays,
    minOrderQuantity: seed.moq ?? 1,
    unit: seed.unit ?? 'unit',
  }
}

export function buildProduct(seed: ProductSeed): Product {
  const category = CATEGORY_BY_KEY.get(seed.category)
  const subcategory = CATEGORY_BY_KEY.get(seed.subcategory)
  const brand = BRAND_BY_KEY.get(seed.brand)
  const seller = SELLER_BY_KEY.get(seed.seller)

  if (!category) throw new Error(`[seed] ${seed.sku}: unknown category "${seed.category}"`)
  if (!subcategory) throw new Error(`[seed] ${seed.sku}: unknown subcategory "${seed.subcategory}"`)
  if (!brand) throw new Error(`[seed] ${seed.sku}: unknown brand "${seed.brand}"`)
  if (!seller) throw new Error(`[seed] ${seed.sku}: unknown seller "${seed.seller}"`)

  const certifications = seed.certifications ?? []
  const ratingCount = pick(`${seed.sku}rc`, 4, 180)
  const ratingAverage = 3.5 + (hash(`${seed.sku}ra`) % 15) / 10

  return {
    id: `prod_${seed.sku.toLowerCase()}`,
    slug: slugify(seed.name, seed.sku),
    sku: seed.sku,
    name: seed.name,
    shortDescription: seed.short,
    description: seed.description,

    categoryId: category.id,
    subcategoryId: subcategory.id,
    brandId: brand.id,
    sellerId: seller.id,

    price: seed.price,
    listPrice: seed.listPrice ?? null,
    currency: 'INR',
    priceUnit: seed.priceUnit ?? 'per unit',
    taxRatePercent: 18,

    status: 'active',
    availability: buildAvailability(seed),

    images: buildImages(seed.sku, seed.artwork, seed.name),
    specs: buildSpecs(seed.sku, seed.specs),

    applications: seed.applications,
    industries: seed.industries ?? [],
    tags: seed.tags,

    documents: buildDocuments(seed.sku, seed.name, certifications),
    warrantyMonths: seed.warrantyMonths ?? 12,
    certifications,
    // Resolved in a second pass once every SKU exists — see linkRelated().
    relatedProductIds: seed.related ?? [],

    rating: seed.rating
      ? { average: seed.rating[0], count: seed.rating[1] }
      : { average: Math.min(4.9, Number(ratingAverage.toFixed(1))), count: ratingCount },

    metrics: {
      views: pick(`${seed.sku}v`, 120, 9_400),
      rfqs: pick(`${seed.sku}r`, 2, 140),
      saves: pick(`${seed.sku}s`, 1, 260),
    },

    createdAt: isoDaysAgo(pick(`${seed.sku}c`, 30, 700)),
    updatedAt: isoDaysAgo(pick(`${seed.sku}u`, 1, 29)),
  }
}

/**
 * Second pass: turn the `related` SKU references into product ids, dropping
 * any that do not resolve. Runs after every seed is built so ordering inside
 * the seed files does not matter.
 */
export function linkRelated(products: Product[]): Product[] {
  const idBySku = new Map(products.map((p) => [p.sku, p.id]))

  return products.map((product) => ({
    ...product,
    relatedProductIds: product.relatedProductIds
      .map((sku) => idBySku.get(sku))
      .filter((id): id is string => Boolean(id)),
  }))
}

export { hash as seedHash, pick as seedPick }
