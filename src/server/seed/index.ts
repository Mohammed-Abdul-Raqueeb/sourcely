import type { Brand, Category, Product, Seller } from '@/lib/domain/catalog'
import { buildProduct, linkRelated, type ProductSeed } from './build-product'
import { BRANDS, CATEGORIES, SELLERS } from './taxonomy'
import { VALVE_SEEDS } from './products/valves'
import { HVAC_SEEDS, PUMP_SEEDS } from './products/climate'
import {
  ELECTRICAL_SEEDS,
  FIRE_SEEDS,
  INSTRUMENT_SEEDS,
  SAFETY_SEEDS,
  TOOL_SEEDS,
} from './products/power-safety'
import { INDUSTRIAL_SEEDS, PLUMBING_SEEDS } from './products/piping-plant'

/**
 * Seed assembly.
 *
 * Runs once per process at module load. `buildProduct` throws on an unknown
 * spec key or an invalid enum value, so a typo in seed data fails the boot
 * rather than producing a product that silently cannot be filtered.
 */

const ALL_SEEDS: ProductSeed[] = [
  ...VALVE_SEEDS,
  ...HVAC_SEEDS,
  ...PUMP_SEEDS,
  ...ELECTRICAL_SEEDS,
  ...FIRE_SEEDS,
  ...INSTRUMENT_SEEDS,
  ...PLUMBING_SEEDS,
  ...INDUSTRIAL_SEEDS,
  ...TOOL_SEEDS,
  ...SAFETY_SEEDS,
]

function assertUniqueSkus(seeds: ProductSeed[]): void {
  const seen = new Set<string>()
  for (const seed of seeds) {
    if (seen.has(seed.sku)) {
      throw new Error(`[seed] duplicate SKU "${seed.sku}"`)
    }
    seen.add(seed.sku)
  }
}

/** SKUs that a seed marked as `featured`, for homepage and category heroes. */
export const FEATURED_SKUS: ReadonlySet<string> = new Set(
  ALL_SEEDS.filter((seed) => seed.featured).map((seed) => seed.sku)
)

function buildCatalog(): {
  products: Product[]
  categories: Category[]
  brands: Brand[]
  sellers: Seller[]
} {
  assertUniqueSkus(ALL_SEEDS)

  const products = linkRelated(ALL_SEEDS.map(buildProduct))

  // Denormalised counts, recomputed from the built catalogue so the numbers
  // shown in the UI are always true rather than hand-maintained.
  const byCategory = new Map<string, number>()
  const byBrand = new Map<string, number>()

  for (const product of products) {
    byCategory.set(product.categoryId, (byCategory.get(product.categoryId) ?? 0) + 1)
    if (product.subcategoryId) {
      byCategory.set(product.subcategoryId, (byCategory.get(product.subcategoryId) ?? 0) + 1)
    }
    byBrand.set(product.brandId, (byBrand.get(product.brandId) ?? 0) + 1)
  }

  const categories = CATEGORIES.map((category) => ({
    ...category,
    productCount: byCategory.get(category.id) ?? 0,
  }))

  const brands = BRANDS.map((brand) => ({
    ...brand,
    productCount: byBrand.get(brand.id) ?? 0,
  }))

  return { products, categories, brands, sellers: SELLERS }
}

const CATALOG = buildCatalog()

export const SEED_PRODUCTS: readonly Product[] = CATALOG.products
export const SEED_CATEGORIES: readonly Category[] = CATALOG.categories
export const SEED_BRANDS: readonly Brand[] = CATALOG.brands
export const SEED_SELLERS: readonly Seller[] = CATALOG.sellers

export { CATEGORY_BY_KEY, BRAND_BY_KEY, SELLER_BY_KEY, TOP_LEVEL_CATEGORIES, childCategories, categoryKeyWithDescendants } from './taxonomy'
