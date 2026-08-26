import 'server-only'
import { unstable_cache } from 'next/cache'
import type { ProductView } from '@/lib/domain/catalog'
import type { CatalogQuery, Page } from '@/lib/domain/search'
import { getCatalogRepository } from '@/server/repositories'

/**
 * Cached catalogue reads for the /products page.
 *
 * The page is dynamic — every filter lives in the URL — but the data it
 * renders is not per-visitor: two people asking for DN50 ball valves get the
 * same result. Caching the search keyed by the full query object turns a warm
 * catalogue request into zero database statements.
 *
 * Consistency is explicit, not hoped for. Catalogue content changes through
 * exactly one door — the admin product actions — and each of them calls
 * `revalidateTag(CATALOG_TAG)`, so an edit is visible on the next request.
 * The five-minute time fallback only bounds drift in the denormalised
 * popularity counters (view/RFQ tallies used by the default sort), which no
 * one edits and no one can name the freshness of anyway.
 */

export const CATALOG_TAG = 'catalog'

export const cachedCatalogSearch = unstable_cache(
  async (query: CatalogQuery): Promise<Page<ProductView>> =>
    getCatalogRepository().search(query),
  ['catalog-search'],
  { tags: [CATALOG_TAG], revalidate: 300 }
)

/**
 * The product page is prerendered, but reaching it from a search (`?q=`)
 * renders it dynamically for the explanation panel — and then the product and
 * related reads, identical for every visitor, should not hit the database
 * per request.
 */
export const cachedProductBySlug = unstable_cache(
  async (slug: string): Promise<ProductView | null> =>
    getCatalogRepository().findBySlug(slug),
  ['catalog-product'],
  { tags: [CATALOG_TAG], revalidate: 300 }
)

export const cachedRelatedProducts = unstable_cache(
  async (productId: string, limit: number): Promise<ProductView[]> =>
    getCatalogRepository().related(productId, limit),
  ['catalog-related'],
  { tags: [CATALOG_TAG], revalidate: 300 }
)
