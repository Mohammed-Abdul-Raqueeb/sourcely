import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/server/auth/session'
import { getCatalogRepository } from '@/server/repositories'
import { specsForCategory } from '@/server/catalog/spec-registry'
import { formatPrice, pluralize } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { CategoryIcon } from '@/components/catalog/category-icon'
import { PageHeader, SectionCard, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Categories' }

/**
 * Category taxonomy.
 *
 * Read-only, and the reason is worth stating: a category is not just a label
 * here, it is the key that decides which specification fields a product has,
 * which facets appear on the listing page, and which weights the ranking model
 * uses. Adding one is a data change in `spec-registry.ts` and
 * `taxonomy.ts` — an admin form that created a category with no spec
 * definitions would produce products nothing could filter.
 */
export default async function AdminCategoriesPage() {
  await requireRole('staff', '/admin/categories')

  const catalog = getCatalogRepository()
  const [topLevel, all, products] = await Promise.all([
    catalog.topLevelCategories(),
    catalog.categories(),
    catalog.listAll(),
  ])

  const priceByCategory = new Map<string, number[]>()
  for (const product of products) {
    if (product.status !== 'active') continue
    const list = priceByCategory.get(product.categoryId) ?? []
    list.push(product.price)
    priceByCategory.set(product.categoryId, list)
  }

  const empty = topLevel.filter((category) => category.productCount === 0)

  return (
    <>
      <PageHeader
        title="Categories"
        description="Each category owns a set of specification fields. That is what makes facets, comparison and ranking work without per-category code."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Top level" value={topLevel.length} />
        <StatCard label="Subcategories" value={all.length - topLevel.length} />
        <StatCard
          label="Empty categories"
          value={empty.length}
          hint={empty.length > 0 ? 'Listed but nothing to show' : 'All have products'}
          tone={empty.length > 0 ? 'accent' : 'neutral'}
        />
        <StatCard label="Products classified" value={products.length} />
      </div>

      <div className="space-y-4">
        {topLevel.map((category) => {
          const children = all.filter((entry) => entry.parentId === category.id)
          const specs = specsForCategory(category.key)
          const critical = specs.filter((spec) => spec.isCritical)
          const filterable = specs.filter((spec) => spec.isFilterable)
          const prices = priceByCategory.get(category.id) ?? []

          return (
            <SectionCard
              key={category.id}
              title={category.name}
              description={`${pluralize(category.productCount, 'product')} · ${specs.length} specification fields · ${critical.length} critical`}
              action={
                <Link
                  href={`/admin/products?category=${category.key}`}
                  className="text-[13px] font-medium text-accent-text hover:underline"
                >
                  Manage
                </Link>
              }
            >
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-accent-text">
                  <CategoryIcon name={category.icon} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-relaxed text-muted">
                    {category.description}
                  </p>

                  {children.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
                        Subcategories
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/admin/products?category=${category.key}`}
                              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[12px] text-text-2 hover:border-accent-line"
                            >
                              {child.name}
                              <span className="font-mono text-[10px] text-faint tnum">
                                {child.productCount}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
                      Filterable specifications
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {filterable.map((spec) => (
                        <Badge
                          key={spec.key}
                          tone={spec.isCritical ? 'accent' : 'neutral'}
                          size="sm"
                          title={spec.hint}
                        >
                          {spec.label}
                          {spec.unit && <span className="text-faint"> ({spec.unit})</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {prices.length > 0 && (
                    <p className="mt-3 border-t border-border pt-3 font-mono text-[11px] text-faint tnum">
                      {formatPrice(Math.min(...prices))} – {formatPrice(Math.max(...prices))}
                    </p>
                  )}
                </div>
              </div>
            </SectionCard>
          )
        })}
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-faint">
        Categories and their specification fields are defined in{' '}
        <code className="font-mono">src/server/seed/taxonomy.ts</code> and{' '}
        <code className="font-mono">src/server/catalog/spec-registry.ts</code>.
        Creating one from a form without spec definitions would produce products
        that nothing can filter, compare or rank — so it is a code change on
        purpose.
      </p>
    </>
  )
}
