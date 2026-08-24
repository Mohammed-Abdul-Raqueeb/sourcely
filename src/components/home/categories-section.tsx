import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { Category } from '@/lib/domain/catalog'
import { SectionHeading } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { CategoryIcon } from '@/components/catalog/category-icon'
import { pluralize } from '@/lib/format'

/**
 * Section 5 — Categories.
 *
 * Counts come from the catalogue, recomputed at seed time, so a category card
 * never advertises products that are not there. The first two cards are wide
 * on desktop, which gives the grid a rhythm without needing decoration.
 */
export function CategoriesSection({
  categories,
  subcategoriesByParent,
}: {
  categories: Category[]
  subcategoriesByParent: Record<string, Category[]>
}) {
  return (
    <section className="section-y border-t border-border">
      <div className="container-page">
        <SectionHeading
          eyebrow="Catalogue"
          title="Ten categories, one specification model"
          description="Every product is stored as a typed specification sheet, not a description with a price. That is what makes a valve and a circuit breaker searchable by the same engine."
          action={
            <ButtonLink href="/categories" variant="secondary" trailingIcon={<ArrowUpRight className="size-4" aria-hidden />}>
              All categories
            </ButtonLink>
          }
        />

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => {
            const children = subcategoriesByParent[category.id] ?? []
            const wide = index < 2

            return (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className={[
                  'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface p-5',
                  'transition-[border-color,background-color,transform] duration-200 ease-out',
                  'hover:-translate-y-0.5 hover:border-accent-line hover:bg-surface-2',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  wide ? 'lg:col-span-1 lg:row-span-1' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-lg border border-border bg-surface-2 text-accent-text transition-colors group-hover:border-accent-line group-hover:bg-accent-soft">
                    <CategoryIcon name={category.icon} />
                  </span>
                  <ArrowUpRight
                    className="size-4 text-faint transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                    aria-hidden
                  />
                </div>

                <h3 className="mt-4 text-[15px] font-semibold text-text">{category.name}</h3>

                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
                  {category.description}
                </p>

                {children.length > 0 && (
                  <p className="mt-3 line-clamp-1 text-[12px] text-faint">
                    {children.map((child) => child.name).join(' · ')}
                  </p>
                )}

                <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-faint tnum">
                  {pluralize(category.productCount, 'product')}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
