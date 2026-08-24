import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { getCatalogRepository } from '@/server/repositories'
import { pluralize } from '@/lib/format'
import { CategoryIcon } from '@/components/catalog/category-icon'

export const metadata: Metadata = {
  title: 'Categories',
  description:
    'Browse the Sourcely catalogue by category — valves, HVAC, pumps, electrical, fire fighting, plumbing, instrumentation, industrial equipment, tools and safety.',
}

/**
 * Category index.
 *
 * Subcategories are listed inline as links rather than hidden behind the
 * parent. A buyer who knows they want a butterfly valve should not have to
 * pass through "Valves & Flow Control" to say so.
 */
export default async function CategoriesPage() {
  const repository = getCatalogRepository()
  const [topLevel, all] = await Promise.all([
    repository.topLevelCategories(),
    repository.categories(),
  ])

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
          <li aria-current="page" className="text-text">
            Categories
          </li>
        </ol>
      </nav>

      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
          Browse by category
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Ten categories, each with its own specification model. A valve is
          filtered by body material and connection type; a breaker by current
          rating and breaking capacity. The facets change with the category
          because the questions do.
        </p>
      </header>

      <div className="space-y-4">
        {topLevel.map((category) => {
          // Empty subcategories are dead ends dressed as links — hide them
          // until they have products.
          const children = all.filter(
            (child) => child.parentId === category.id && child.productCount > 0
          )

          return (
            <section
              key={category.id}
              className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong md:p-6"
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                <div className="flex items-start gap-4 md:w-2/5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-accent-text">
                    <CategoryIcon name={category.icon} />
                  </span>

                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-text">
                      <Link
                        href={`/categories/${category.slug}`}
                        className="inline-flex items-center gap-1.5 hover:text-accent-text"
                      >
                        {category.name}
                        <ArrowUpRight className="size-4 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </h2>
                    <p className="mt-1 font-mono text-[11px] text-faint tnum">
                      {pluralize(category.productCount, 'product')}
                    </p>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-muted md:hidden">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="hidden text-[13px] leading-relaxed text-muted md:block">
                    {category.description}
                  </p>

                  {children.length > 0 && (
                    <ul className="mt-3.5 flex flex-wrap gap-1.5">
                      {children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={`/products?cat=${child.key}`}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[12px] text-text-2 transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-text"
                          >
                            {child.name}
                            <span className="font-mono text-[10px] text-faint tnum">
                              {child.productCount}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
