import type { Brand, Category, Product, ProductView, Seller } from '@/lib/domain/catalog'
import type { CatalogQuery, Page, RankedPage, RankedProduct, SearchIntent } from '@/lib/domain/search'
import { CatalogIndex } from '@/server/catalog/search-engine'
import {
  FEATURED_SKUS,
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_SELLERS,
} from '@/server/seed'
import type { CatalogRepository, CatalogStats } from '../types'
import { getStore, persist } from './store'

/**
 * In-memory catalogue driver.
 *
 * The catalogue is the seed data with the admin overlay applied on top, joined
 * into `ProductView` and indexed once. The index is rebuilt only when
 * `catalogVersion` changes, so a product edit invalidates it and a thousand
 * page views do not.
 */

interface Joined {
  index: CatalogIndex
  categories: Category[]
  brands: Brand[]
  sellers: Seller[]
  version: number
}

function join(
  products: readonly Product[],
  categories: readonly Category[],
  brands: readonly Brand[],
  sellers: readonly Seller[]
): ProductView[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const brandById = new Map(brands.map((brand) => [brand.id, brand]))
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]))

  const views: ProductView[] = []

  for (const product of products) {
    const category = categoryById.get(product.categoryId)
    const brand = brandById.get(product.brandId)
    const seller = sellerById.get(product.sellerId)

    // A product whose taxonomy failed to resolve is a data fault. Seed data
    // throws at boot; an admin-authored record is skipped instead, because one
    // bad row must not take the whole catalogue offline.
    if (!category || !brand || !seller) {
      console.error(
        `[catalog] ${product.sku}: unresolved taxonomy ` +
          `(category=${!!category} brand=${!!brand} seller=${!!seller}) — skipped`
      )
      continue
    }

    views.push({
      ...product,
      category,
      subcategory: product.subcategoryId
        ? (categoryById.get(product.subcategoryId) ?? null)
        : null,
      brand,
      seller,
    })
  }

  return views
}

/**
 * Applies the admin overlay to the seed catalogue.
 *
 * Same id overrides; new id appends. Archived products are dropped from the
 * public catalogue here rather than filtered at every call site.
 */
function mergeProducts(overlay: readonly Product[]): Product[] {
  if (overlay.length === 0) {
    return SEED_PRODUCTS.filter((product) => product.status !== 'archived')
  }

  const byId = new Map<string, Product>(SEED_PRODUCTS.map((product) => [product.id, product]))
  for (const product of overlay) byId.set(product.id, product)

  return [...byId.values()].filter((product) => product.status !== 'archived')
}

let cached: Joined | null = null

async function catalog(): Promise<Joined> {
  const store = await getStore()
  if (cached && cached.version === store.catalogVersion) return cached

  const merged = mergeProducts(store.productOverlay)
  const views = join(merged, SEED_CATEGORIES, SEED_BRANDS, SEED_SELLERS)

  // Category and brand counts are denormalised, so they have to be recomputed
  // against the merged catalogue or an admin edit silently desyncs them.
  const byCategory = new Map<string, number>()
  const byBrand = new Map<string, number>()
  for (const product of views) {
    byCategory.set(product.categoryId, (byCategory.get(product.categoryId) ?? 0) + 1)
    if (product.subcategoryId) {
      byCategory.set(product.subcategoryId, (byCategory.get(product.subcategoryId) ?? 0) + 1)
    }
    byBrand.set(product.brandId, (byBrand.get(product.brandId) ?? 0) + 1)
  }

  cached = {
    index: new CatalogIndex(views),
    categories: SEED_CATEGORIES.map((category) => ({
      ...category,
      productCount: byCategory.get(category.id) ?? 0,
    })),
    brands: SEED_BRANDS.map((brand) => ({
      ...brand,
      productCount: byBrand.get(brand.id) ?? 0,
    })),
    sellers: [...SEED_SELLERS],
    version: store.catalogVersion,
  }

  return cached
}

export class MemoryCatalogRepository implements CatalogRepository {
  async search(query: CatalogQuery): Promise<Page<ProductView>> {
    return (await catalog()).index.search(query)
  }

  async rankByIntent(intent: SearchIntent, limit = 12): Promise<RankedPage> {
    return (await catalog()).index.rank(intent, limit)
  }

  async findBySlug(slug: string): Promise<ProductView | null> {
    return (await catalog()).index.bySlug.get(slug) ?? null
  }

  async findById(id: string): Promise<ProductView | null> {
    return (await catalog()).index.byId.get(id) ?? null
  }

  async findManyByIds(ids: string[]): Promise<ProductView[]> {
    const { byId } = (await catalog()).index
    return ids
      .map((id) => byId.get(id))
      .filter((product): product is ProductView => product != null)
  }

  async related(productId: string, limit = 4): Promise<ProductView[]> {
    const { index } = await catalog()
    const product = index.byId.get(productId)
    if (!product) return []
    return index.related(product, limit)
  }

  async explain(productId: string, intent: SearchIntent): Promise<RankedProduct | null> {
    const { index } = await catalog()
    const product = index.byId.get(productId)
    if (!product) return null
    return index.explain(product, intent)
  }

  async featured(limit = 8): Promise<ProductView[]> {
    const { index } = await catalog()
    const flagged = index.products.filter((product) => FEATURED_SKUS.has(product.sku))
    if (flagged.length >= limit) return flagged.slice(0, limit)

    // Top up by demand so the homepage never renders a short row.
    const rest = index.products
      .filter((product) => !FEATURED_SKUS.has(product.sku))
      .sort((a, b) => b.metrics.rfqs - a.metrics.rfqs)

    return [...flagged, ...rest].slice(0, limit)
  }

  async allSlugs(): Promise<string[]> {
    return (await catalog()).index.products.map((product) => product.slug)
  }

  async categories(): Promise<Category[]> {
    return (await catalog()).categories
  }

  async topLevelCategories(): Promise<Category[]> {
    return (await catalog()).categories.filter((category) => category.parentId === null)
  }

  async categoryBySlug(slug: string): Promise<Category | null> {
    return (await catalog()).categories.find((category) => category.slug === slug) ?? null
  }

  async childrenOf(categoryId: string): Promise<Category[]> {
    return (await catalog()).categories.filter((category) => category.parentId === categoryId)
  }

  async brands(): Promise<Brand[]> {
    return (await catalog()).brands
  }

  async brandBySlug(slug: string): Promise<Brand | null> {
    return (await catalog()).brands.find((brand) => brand.slug === slug) ?? null
  }

  async sellers(): Promise<Seller[]> {
    return (await catalog()).sellers
  }

  async count(query: CatalogQuery = {}): Promise<number> {
    return (await catalog()).index.count(query)
  }

  async stats(): Promise<CatalogStats> {
    const { index, categories, brands, sellers } = await catalog()
    const products = index.products
    const total = products.reduce((sum, product) => sum + product.price, 0)

    return {
      products: products.length,
      categories: categories.filter((category) => category.parentId === null).length,
      brands: brands.length,
      sellers: sellers.length,
      inStock: products.filter((product) => product.availability.state === 'in_stock').length,
      averagePrice: products.length > 0 ? Math.round(total / products.length) : 0,
    }
  }

  /* ------------------------------------------------------------------ writes */

  /**
   * Reads a product including archived ones.
   *
   * The public getters filter archived records out, which is right for the
   * catalogue and wrong for the admin edit form — an archived product still
   * has to be openable and restorable.
   */
  async findAnyById(id: string): Promise<Product | null> {
    const store = await getStore()
    return (
      store.productOverlay.find((product) => product.id === id) ??
      SEED_PRODUCTS.find((product) => product.id === id) ??
      null
    )
  }

  async listAll(): Promise<Product[]> {
    const store = await getStore()
    const byId = new Map<string, Product>(SEED_PRODUCTS.map((p) => [p.id, p]))
    for (const product of store.productOverlay) byId.set(product.id, product)
    return [...byId.values()]
  }

  async upsertProduct(product: Product): Promise<Product> {
    const store = await getStore()
    const index = store.productOverlay.findIndex((entry) => entry.id === product.id)

    if (index >= 0) store.productOverlay[index] = product
    else store.productOverlay.push(product)

    // Invalidates the search index on the next read.
    store.catalogVersion += 1
    persist()
    return product
  }

  async setProductStatus(id: string, status: Product['status']): Promise<Product | null> {
    const current = await this.findAnyById(id)
    if (!current) return null
    return this.upsertProduct({
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    })
  }
}
