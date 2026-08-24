import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react'
import { getCatalogRepository } from '@/server/repositories'
import { highlightSpecs } from '@/server/catalog/highlights'
import { specsForCategory } from '@/server/catalog/spec-registry'
import { formatPrice, pluralize } from '@/lib/format'
import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CategoryIcon } from '@/components/catalog/category-icon'
import { ProductCard } from '@/components/catalog/product-card'
import { StateBlock } from '@/components/ui/states'

/**
 * Category landing page.
 *
 * Doubles as the SEO surface for the category and as an orientation page: it
 * names the specifications this category is actually filtered by, which is
 * the fastest way to teach a buyer what questions the catalogue can answer.
 */

export async function generateStaticParams() {
  const categories = await getCatalogRepository().topLevelCategories()
  return categories.map((category) => ({ slug: category.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = await getCatalogRepository().categoryBySlug(slug)
  if (!category) return { title: 'Category not found' }

  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/categories/${category.slug}` },
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const repository = getCatalogRepository()

  const category = await repository.categoryBySlug(slug)
  if (!category) notFound()

  const [allChildren, page] = await Promise.all([
    repository.childrenOf(category.id),
    repository.search({ categoryKeys: [category.key], sort: 'popular', limit: 8 }),
  ])
  // Empty subcategories are dead ends dressed as links — hide them until
  // they have products. Mirrors the categories index.
  const children = allChildren.filter((child) => child.productCount > 0)

  const filterable = specsForCategory(category.key).filter((spec) => spec.isFilterable)
  const prices = page.items.map((product) => product.price)

  return (
    <div className="container-page py-8 lg:py-12">
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex items-center gap-1.5 text-[13px] text-muted">
          <li>
            <Link href="/" className="hover:text-text">
              Home
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li>
            <Link href="/categories" className="hover:text-text">
              Categories
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li aria-current="page" className="text-text">
            {category.name}
          </li>
        </ol>
      </nav>

      {/* Header ------------------------------------------------------------ */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6 md:p-9">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-40 mask-fade-b" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <span className="grid size-12 place-items-center rounded-xl border border-border bg-surface-2 text-accent-text">
              <CategoryIcon name={category.icon} className="size-5.5" />
            </span>

            <h1 className="mt-5 font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
              {category.name}
            </h1>
            <p className="mt-3.5 text-[15px] leading-relaxed text-muted md:text-base">
              {category.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={`/products?cat=${category.key}`} trailingIcon={<ArrowRight className="size-4" aria-hidden />}>
                Browse all {pluralize(category.productCount, 'product')}
              </ButtonLink>
              <ButtonLink
                href="/assistant"
                variant="secondary"
                leadingIcon={<Sparkles className="size-4" aria-hidden />}
              >
                Describe what you need
              </ButtonLink>
            </div>
          </div>

          {/* Category facts ------------------------------------------------- */}
          <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 rounded-lg border border-border bg-surface-2 p-5 lg:w-64">
            <div>
              <dt className="text-[11px] tracking-wide text-faint uppercase">Products</dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold text-text tnum">
                {category.productCount}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-faint uppercase">Subcategories</dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold text-text tnum">
                {children.length}
              </dd>
            </div>
            {prices.length > 0 && (
              <div className="col-span-2">
                <dt className="text-[11px] tracking-wide text-faint uppercase">Price range</dt>
                <dd className="mt-0.5 font-mono text-[13px] text-text-2 tnum">
                  {formatPrice(Math.min(...prices))} – {formatPrice(Math.max(...prices))}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {/* Subcategories ------------------------------------------------------ */}
      {children.length > 0 && (
        <section aria-labelledby="subcategories-heading" className="mt-10">
          <h2 id="subcategories-heading" className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
            Subcategories
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/products?cat=${child.key}`}
                className="group rounded-lg border border-border bg-surface p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent-line"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-text">{child.name}</h3>
                  <span className="font-mono text-[11px] text-faint tnum">
                    {child.productCount}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                  {child.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Filterable specifications ------------------------------------------ */}
      {filterable.length > 0 && (
        <section aria-labelledby="specs-heading" className="mt-10">
          <h2 id="specs-heading" className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
            Filterable in this category
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {filterable.map((spec) => (
              <Badge key={spec.key} tone="neutral" size="md" title={spec.hint}>
                {spec.label}
                {spec.unit && <span className="text-faint"> ({spec.unit})</span>}
              </Badge>
            ))}
          </div>
          <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-faint">
            These are typed fields on every product in this category, not
            keywords — so a range filter on {filterable.find((s) => s.dataType === 'number')?.label.toLowerCase() ?? 'a numeric spec'} means what it says.
          </p>
        </section>
      )}

      {/* Popular products --------------------------------------------------- */}
      <section aria-labelledby="popular-heading" className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="popular-heading" className="font-display text-2xl font-semibold tracking-tight">
            Most enquired
          </h2>
          <Link
            href={`/products?cat=${category.key}`}
            className="shrink-0 text-sm font-medium text-accent-text hover:underline"
          >
            View all
          </Link>
        </div>

        {page.items.length === 0 ? (
          <StateBlock
            title="Nothing listed here yet"
            description="This category has no active products at the moment. The assistant can suggest the nearest equivalents from adjacent categories."
            primaryAction={{ label: 'Ask the assistant', href: '/assistant' }}
            secondaryAction={{ label: 'All categories', href: '/categories' }}
            compact
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {page.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                highlights={highlightSpecs(product, 3)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
