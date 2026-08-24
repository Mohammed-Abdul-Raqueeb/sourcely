import type { Metadata } from 'next'
import Link from 'next/link'
import { Columns3, FileText, StickyNote } from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { highlightSpecs } from '@/server/catalog/highlights'
import { formatPrice, formatRelative, pluralize } from '@/lib/format'
import { ButtonLink } from '@/components/ui/button'
import { EmptySavedState } from '@/components/ui/states'
import { ProductCard } from '@/components/catalog/product-card'
import { PageHeader } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Shortlist' }

/**
 * Shortlist.
 *
 * The two actions at the top are the whole reason a shortlist exists in a
 * B2B catalogue: compare the specifications, then turn the survivors into one
 * quotation request. Everything else on this page is supporting detail.
 */
export default async function SavedPage() {
  const user = await requireUser('/account/saved')

  const saved = await getActivityRepository().listSavedProducts(user.id)
  const products = await getCatalogRepository().findManyByIds(
    saved.map((entry) => entry.productId)
  )

  // Preserve save order and pair each product with its note.
  const byId = new Map(products.map((product) => [product.id, product]))
  const entries = saved
    .map((entry) => ({ entry, product: byId.get(entry.productId) }))
    .filter((row): row is { entry: (typeof saved)[number]; product: NonNullable<typeof products[number]> } =>
      row.product != null
    )

  const total = entries.reduce((sum, row) => sum + row.product.price, 0)
  const compareIds = entries.slice(0, 4).map((row) => row.product.id)

  return (
    <>
      <PageHeader
        title="Shortlist"
        description={
          entries.length > 0
            ? `${pluralize(entries.length, 'product')} saved · ${formatPrice(total)} at single-unit rates`
            : 'Products you save while browsing collect here.'
        }
        action={
          entries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {entries.length >= 2 && (
                <ButtonLink
                  href={`/compare?ids=${compareIds.join(',')}`}
                  variant="secondary"
                  leadingIcon={<Columns3 className="size-4" aria-hidden />}
                >
                  Compare {Math.min(4, entries.length)}
                </ButtonLink>
              )}
              <ButtonLink
                href={`/account/rfq/new?product=${entries.map((row) => row.product.id).join(',')}`}
                leadingIcon={<FileText className="size-4" aria-hidden />}
              >
                Request quotation
              </ButtonLink>
            </div>
          )
        }
      />

      {entries.length === 0 ? (
        <EmptySavedState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map(({ entry, product }) => (
            <div key={product.id} className="flex flex-col gap-2">
              <ProductCard product={product} highlights={highlightSpecs(product, 3)} />

              <div className="rounded-lg border border-border bg-surface-2/60 px-3 py-2">
                {entry.note ? (
                  <p className="flex gap-2 text-[12px] leading-relaxed text-text-2">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                    {entry.note}
                  </p>
                ) : (
                  <p className="text-[12px] text-faint">No note</p>
                )}
                <p className="mt-1.5 text-[11px] text-faint">
                  Saved {formatRelative(entry.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {entries.length > 4 && (
        <p className="mt-6 text-center text-[13px] text-faint">
          Comparison takes up to four at a time.{' '}
          <Link href="/compare" className="text-accent-text hover:underline">
            Choose which four
          </Link>
        </p>
      )}
    </>
  )
}
