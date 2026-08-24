'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bookmark, Check, Minus, X } from 'lucide-react'
import type { ProductView } from '@/lib/domain/catalog'
import { cn } from '@/lib/cn'
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONE,
  formatLeadTime,
  formatPrice,
  formatWarranty,
} from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/button'
import { ProductMedia } from './product-card'
import { useShortlist } from './shortlist'

/**
 * Specification comparison grid.
 *
 * Two rules make this readable rather than a wall of text:
 *
 *   1. Rows where every product agrees are dimmed and can be hidden entirely.
 *      The reader came here for the differences; identical rows are noise.
 *   2. Within a differing row, the best value is marked — cheapest price,
 *      longest warranty, readiest stock. Only where "best" is unambiguous;
 *      a body material has no winner and is not marked.
 */

export interface CompareRow {
  key: string
  label: string
  unit?: string
  values: (string | null)[]
  /** Index of the strongest value, or null when there is no natural best. */
  bestIndex: number | null
  identical: boolean
  group: string
}

export function ComparisonGrid({
  products,
  rows,
}: {
  products: ProductView[]
  rows: CompareRow[]
}) {
  const router = useRouter()
  const { removeCompare, isSaved, toggleSaved, ready } = useShortlist()
  const [onlyDifferences, setOnlyDifferences] = useState(false)

  const differingCount = rows.filter((row) => !row.identical).length

  const visible = useMemo(
    () => (onlyDifferences ? rows.filter((row) => !row.identical) : rows),
    [rows, onlyDifferences]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, CompareRow[]>()
    for (const row of visible) {
      const list = map.get(row.group) ?? []
      list.push(row)
      map.set(row.group, list)
    }
    return [...map.entries()]
  }, [visible])

  function drop(productId: string) {
    removeCompare(productId)
    const next = products.filter((product) => product.id !== productId).map((p) => p.id)
    router.replace(next.length > 0 ? `/compare?ids=${next.join(',')}` : '/compare')
  }

  return (
    <div>
      {/* Controls -------------------------------------------------------- */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={onlyDifferences}
            onChange={(event) => setOnlyDifferences(event.target.checked)}
            className="size-4 cursor-pointer appearance-none rounded-xs border border-border-strong bg-surface-2 transition-colors checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          Show only what differs
        </label>
        <span className="font-mono text-[11px] text-faint tnum">
          {differingCount} of {rows.length} rows differ
        </span>
      </div>

      {/* Grid ------------------------------------------------------------ */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface scrollbar-slim">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Specification comparison of {products.length} products
          </caption>

          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-1 w-40 bg-surface px-4 py-4 text-left align-bottom text-[11px] font-semibold tracking-wider text-faint uppercase sm:w-52"
              >
                Specification
              </th>

              {products.map((product) => {
                const image = product.images[0]
                const saved = ready && isSaved(product.id)

                return (
                  <th
                    key={product.id}
                    scope="col"
                    className="min-w-[13rem] px-4 py-4 text-left align-top"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-20 overflow-hidden rounded-lg">
                        <ProductMedia
                          image={image}
                          label={product.name}
                          className="aspect-[4/3] w-full"
                          sizes="80px"
                        />
                      </div>

                      <div className="flex gap-0.5">
                        <IconButton
                          label={saved ? `Remove ${product.name} from shortlist` : `Save ${product.name}`}
                          size="xs"
                          onClick={() => toggleSaved(product.id)}
                          className={saved ? 'text-accent-text' : undefined}
                        >
                          <Bookmark className={cn('size-3.5', saved && 'fill-current')} aria-hidden />
                        </IconButton>
                        <IconButton
                          label={`Remove ${product.name} from comparison`}
                          size="xs"
                          onClick={() => drop(product.id)}
                          className="hover:text-danger"
                        >
                          <X className="size-3.5" aria-hidden />
                        </IconButton>
                      </div>
                    </div>

                    <p className="mt-3 text-[11px] font-medium tracking-wide text-muted uppercase">
                      {product.brand.name}
                    </p>
                    <Link
                      href={`/products/${product.slug}`}
                      className="mt-0.5 block text-[13px] leading-snug font-semibold text-text hover:text-accent-text"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 font-mono text-[11px] text-faint tnum">{product.sku}</p>

                    <p className="mt-2.5 font-mono text-[17px] font-semibold text-text tnum">
                      {formatPrice(product.price)}
                    </p>

                    <div className="mt-2">
                      <Badge tone={AVAILABILITY_TONE[product.availability.state]} size="sm" dot>
                        {AVAILABILITY_LABELS[product.availability.state]}
                      </Badge>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          {grouped.map(([group, groupRows]) => (
            <tbody key={group} className="divide-y divide-border">
              <tr>
                <th
                  scope="colgroup"
                  colSpan={products.length + 1}
                  className="sticky left-0 bg-surface-2/60 px-4 py-2 text-left text-[10px] font-semibold tracking-[0.14em] text-faint uppercase"
                >
                  {group}
                </th>
              </tr>

              {groupRows.map((row) => (
                <tr key={row.key} className={cn(!row.identical && 'bg-surface-2/30')}>
                  <th
                    scope="row"
                    className="sticky left-0 z-1 bg-surface px-4 py-3 text-left text-[13px] font-medium text-muted"
                  >
                    {row.label}
                    {row.unit && <span className="ml-1 text-faint">({row.unit})</span>}
                  </th>

                  {row.values.map((value, index) => {
                    const best = row.bestIndex === index && !row.identical
                    return (
                      <td
                        key={`${row.key}-${index}`}
                        className={cn(
                          'px-4 py-3 font-mono text-[13px] tnum',
                          value == null
                            ? 'text-faint'
                            : row.identical
                              ? 'text-faint'
                              : 'font-medium text-text'
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {value == null ? (
                            <>
                              <Minus className="size-3 text-faint" aria-hidden />
                              <span className="sr-only">Not published</span>
                            </>
                          ) : (
                            value
                          )}
                          {best && (
                            <Check
                              className="size-3.5 text-success"
                              aria-label="Strongest in this row"
                            />
                          )}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-faint">
        A dash means the supplier does not publish that specification — not that
        the product lacks it. Ticks mark the strongest value in rows where
        &ldquo;strongest&rdquo; is unambiguous: lowest price, longest warranty,
        readiest stock, highest rating.
      </p>

      {/* Helpers reused by the caller's copy */}
      <span className="sr-only">
        {products
          .map(
            (product) =>
              `${product.name}: ${formatPrice(product.price)}, ${formatWarranty(product.warrantyMonths)}, ${formatLeadTime(product.availability.leadTimeDays)}`
          )
          .join('. ')}
      </span>
    </div>
  )
}
