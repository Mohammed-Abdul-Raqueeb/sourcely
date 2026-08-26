import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Sparkles } from 'lucide-react'
import { parseCatalogParams, type RawSearchParams } from '@/lib/catalog-params'
import { pluralize } from '@/lib/format'
import { cachedCatalogSearch } from '@/server/catalog/cached-search'
import { highlightSpecs } from '@/server/catalog/highlights'
import { ProductCard, ProductRow } from '@/components/catalog/product-card'
import { FilterPanel } from '@/components/catalog/filter-panel'
import { CatalogToolbar } from '@/components/catalog/catalog-toolbar'
import { LoadMore } from '@/components/catalog/load-more'
import { PAGE_CAP, PAGE_SIZE } from '@/lib/pagination'
import { NoResultsState } from '@/components/ui/states'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Browse verified industrial products by category, brand and specification — valves, HVAC, pumps, electrical, fire fighting, plumbing, instrumentation, tools and safety equipment.',
}

/**
 * Product listing.
 *
 * All filter state comes from the URL, so this renders on the server with no
 * client-side data fetching. The filter panel and toolbar are client islands
 * that do nothing but rewrite the URL.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const raw = await searchParams
  const params = parseCatalogParams(raw)

  const requested = Number.parseInt(
    (Array.isArray(raw.show) ? raw.show[0] : raw.show) ?? '',
    10
  )
  const limit = Number.isFinite(requested)
    ? Math.min(PAGE_CAP, Math.max(PAGE_SIZE, requested))
    : PAGE_SIZE

  const page = await cachedCatalogSearch({ ...params, limit })

  const cards = page.items.map((product) => ({
    product,
    highlights: highlightSpecs(product, params.view === 'list' ? 3 : 3),
  }))

  return (
    <div className="container-page py-8 lg:py-12">
      {/* Breadcrumb + header ---------------------------------------------- */}
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex items-center gap-1.5 text-[13px] text-muted">
          <li>
            <Link href="/" className="hover:text-text">
              Home
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li aria-current="page" className="text-text">
            Products
          </li>
        </ol>
      </nav>

      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
            {params.text ? (
              <>
                Results for <span className="text-accent-text">“{params.text}”</span>
              </>
            ) : (
              'Product catalogue'
            )}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            {params.text
              ? `${pluralize(page.total, 'product')} matched your search. Keyword search filters the catalogue — for a requirement in your own words, use AI search.`
              : 'Every product is stored as a typed specification sheet, so material, size, pressure class and application are all filterable — not buried in a description.'}
          </p>
        </div>

        <ButtonLink
          href="/assistant"
          variant="secondary"
          leadingIcon={<Sparkles className="size-4" aria-hidden />}
          className="shrink-0"
        >
          Describe what you need
        </ButtonLink>
      </div>

      {/* Body -------------------------------------------------------------- */}
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-2 scrollbar-slim">
          <FilterPanel facets={page.facets} params={params} total={page.total} />
        </div>

        <div className="min-w-0">
          <CatalogToolbar
            params={params}
            facets={page.facets}
            total={page.total}
            tookMs={page.tookMs}
            showing={page.items.length}
          />

          {page.items.length === 0 ? (
            <div className="mt-8">
              <NoResultsState query={params.text} />
            </div>
          ) : params.view === 'list' ? (
            <div className="mt-6 space-y-3">
              {cards.map(({ product, highlights }) => (
                <ProductRow key={product.id} product={product} highlights={highlights} />
              ))}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map(({ product, highlights }, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  highlights={highlights}
                  priority={index < 3}
                />
              ))}
            </div>
          )}

          {page.items.length > 0 && (
            <LoadMore showing={page.items.length} total={page.total} />
          )}
        </div>
      </div>
    </div>
  )
}
