import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Package, Plus, Search } from 'lucide-react'
import type { Product } from '@/lib/domain/catalog'
import { requireRole } from '@/server/auth/session'
import { getCatalogRepository } from '@/server/repositories'
import { BRAND_BY_ID, CATEGORY_BY_ID } from '@/server/seed/taxonomy'
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONE,
  formatDate,
  formatPrice,
  pluralize,
} from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, StatCard } from '@/components/account/ui'
import { ProductStatusControl } from '@/components/admin/product-status'

export const metadata: Metadata = { title: 'Products' }

const STATUS_TONE = {
  active: 'success',
  draft: 'warning',
  archived: 'neutral',
} as const

/**
 * Catalogue management.
 *
 * Filter state lives in the URL for the same reason it does on the public
 * listing: an operator sending a colleague "the 4 drafts missing a critical
 * spec" should be sending a link, not instructions.
 *
 * The "incomplete" filter is the one that earns its place — a product with no
 * material or no size will lose every search that specifies one, silently.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; issue?: string }>
}) {
  await requireRole('staff', '/admin/products')
  const { q, status, category, issue } = await searchParams

  const catalog = getCatalogRepository()
  const all = await catalog.listAll()

  const needle = q?.trim().toLowerCase() ?? ''

  const incomplete = (product: Product) =>
    product.specs.length < 3 || product.tags.length === 0 || product.applications.length === 0

  const filtered = all
    .filter((product) => (status ? product.status === status : true))
    .filter((product) =>
      category ? CATEGORY_BY_ID.get(product.categoryId)?.key === category : true
    )
    .filter((product) => (issue === 'incomplete' ? incomplete(product) : true))
    .filter((product) =>
      needle
        ? product.name.toLowerCase().includes(needle) ||
          product.sku.toLowerCase().includes(needle) ||
          product.tags.some((tag) => tag.toLowerCase().includes(needle))
        : true
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const counts = {
    total: all.length,
    active: all.filter((product) => product.status === 'active').length,
    draft: all.filter((product) => product.status === 'draft').length,
    archived: all.filter((product) => product.status === 'archived').length,
    incomplete: all.filter(incomplete).length,
  }

  const chip = (label: string, href: string, active: boolean, count?: number) => (
    <Link
      key={label}
      href={href}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-accent-line bg-accent-soft text-accent-text'
          : 'border-border bg-surface-2 text-muted hover:border-border-strong hover:text-text'
      )}
    >
      {label}
      {count != null && <span className="font-mono text-[10px] text-faint tnum">{count}</span>}
    </Link>
  )

  return (
    <>
      <PageHeader
        title="Products"
        description={`${pluralize(counts.total, 'product')} in the catalogue · ${counts.active} live`}
        action={
          <ButtonLink href="/admin/products/new" leadingIcon={<Plus className="size-4" aria-hidden />}>
            Add product
          </ButtonLink>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active" value={counts.active} icon={Package} />
        <StatCard label="Drafts" value={counts.draft} hint="Not visible to buyers" />
        <StatCard label="Archived" value={counts.archived} />
        <StatCard
          label="Incomplete"
          value={counts.incomplete}
          hint="Thin specs, tags or applications"
          icon={AlertTriangle}
          tone={counts.incomplete > 0 ? 'accent' : 'neutral'}
          href="/admin/products?issue=incomplete"
        />
      </div>

      {/* Filters ------------------------------------------------------------ */}
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search name, SKU or tag"
            aria-label="Search products"
            className="h-9 w-full rounded-md border border-border bg-surface-2 pr-3 pl-10 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        {category && <input type="hidden" name="category" value={category} />}
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Search
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {chip('All', '/admin/products', !status && !issue, counts.total)}
        {chip('Active', '/admin/products?status=active', status === 'active', counts.active)}
        {chip('Drafts', '/admin/products?status=draft', status === 'draft', counts.draft)}
        {chip('Archived', '/admin/products?status=archived', status === 'archived', counts.archived)}
        {chip(
          'Needs attention',
          '/admin/products?issue=incomplete',
          issue === 'incomplete',
          counts.incomplete
        )}
      </div>

      {/* Table --------------------------------------------------------------- */}
      {filtered.length === 0 ? (
        <StateBlock
          title="No products match"
          description="Nothing in the catalogue matches those filters. Clear them, or add a product."
          primaryAction={{ label: 'Clear filters', href: '/admin/products' }}
          secondaryAction={{ label: 'Add product', href: '/admin/products/new' }}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface scrollbar-slim">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">
              {pluralize(filtered.length, 'product')} matching the current filters
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                <th scope="col" className="px-3 py-3 font-semibold">Category</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Price</th>
                <th scope="col" className="px-3 py-3 font-semibold">Stock</th>
                <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Updated</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filtered.map((product) => {
                const categoryName = CATEGORY_BY_ID.get(product.categoryId)?.name ?? '—'
                const brandName = BRAND_BY_ID.get(product.brandId)?.name ?? '—'
                const thin = incomplete(product)

                return (
                  <tr key={product.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-[13.5px] font-medium text-text hover:text-accent-text"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-faint tnum">
                        {product.sku}
                        <span className="font-sans not-italic">{brandName}</span>
                        {thin && (
                          <span
                            className="inline-flex items-center gap-1 font-sans text-warning"
                            title="Thin specifications, tags or applications — this product will lose specific searches"
                          >
                            <AlertTriangle className="size-3" aria-hidden />
                            thin
                          </span>
                        )}
                      </p>
                    </td>

                    <td className="px-3 py-3 text-[13px] text-muted">{categoryName}</td>

                    <td className="px-3 py-3 text-right font-mono text-[13px] text-text tnum">
                      {formatPrice(product.price)}
                    </td>

                    <td className="px-3 py-3">
                      <Badge tone={AVAILABILITY_TONE[product.availability.state]} size="sm" dot>
                        {AVAILABILITY_LABELS[product.availability.state]}
                      </Badge>
                      {product.availability.quantityOnHand != null && (
                        <span className="ml-2 font-mono text-[11px] text-faint tnum">
                          {product.availability.quantityOnHand}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <Badge tone={STATUS_TONE[product.status]} size="sm">
                        {product.status}
                      </Badge>
                    </td>

                    <td className="px-3 py-3 text-right font-mono text-[12px] text-faint tnum">
                      {formatDate(product.updatedAt)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <ProductStatusControl productId={product.id} status={product.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[12px] text-faint">
        Showing {pluralize(filtered.length, 'product')}
        {filtered.length !== counts.total && ` of ${counts.total}`}.
      </p>
    </>
  )
}
