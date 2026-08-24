import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Boxes, PackageX, Timer } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getCatalogRepository } from '@/server/repositories'
import { BRAND_BY_ID, CATEGORY_BY_ID, SELLER_BY_ID } from '@/server/seed/taxonomy'
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONE,
  formatCompactINR,
  formatPrice,
  pluralize,
} from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { PageHeader, SectionCard, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Inventory' }

/** Stock at or below this on an active product is worth attention. */
const LOW_STOCK_THRESHOLD = 12

/**
 * Inventory.
 *
 * Ordered by risk, not alphabetically: out of stock first, then low stock,
 * then everything else. An inventory screen sorted by name is a screen nobody
 * opens twice.
 */
export default async function AdminInventoryPage() {
  await requireRole('staff', '/admin/inventory')

  const products = (await getCatalogRepository().listAll()).filter(
    (product) => product.status === 'active'
  )

  const risk = (product: (typeof products)[number]): number => {
    if (product.availability.state === 'out_of_stock') return 0
    if (product.availability.state === 'low_stock') return 1
    if ((product.availability.quantityOnHand ?? Infinity) <= LOW_STOCK_THRESHOLD) return 2
    if (product.availability.state === 'made_to_order') return 3
    return 4
  }

  const ordered = [...products].sort(
    (a, b) =>
      risk(a) - risk(b) ||
      (a.availability.quantityOnHand ?? 0) - (b.availability.quantityOnHand ?? 0)
  )

  const outOfStock = products.filter((p) => p.availability.state === 'out_of_stock')
  const lowStock = products.filter(
    (p) =>
      p.availability.state === 'low_stock' ||
      (p.availability.quantityOnHand != null &&
        p.availability.quantityOnHand > 0 &&
        p.availability.quantityOnHand <= LOW_STOCK_THRESHOLD)
  )
  const madeToOrder = products.filter((p) => p.availability.state === 'made_to_order')

  const stockValue = products.reduce(
    (sum, product) => sum + product.price * (product.availability.quantityOnHand ?? 0),
    0
  )

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Active products ordered by risk — anything out of stock or running low is at the top."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Out of stock"
          value={outOfStock.length}
          hint="Still listed, cannot ship"
          icon={PackageX}
          tone={outOfStock.length > 0 ? 'accent' : 'neutral'}
        />
        <StatCard
          label="Running low"
          value={lowStock.length}
          hint={`At or under ${LOW_STOCK_THRESHOLD} units`}
          icon={AlertTriangle}
        />
        <StatCard label="Made to order" value={madeToOrder.length} icon={Timer} />
        <StatCard
          label="Stock value"
          value={formatCompactINR(stockValue)}
          hint="At list price, excl. GST"
          icon={Boxes}
        />
      </div>

      {outOfStock.length > 0 && (
        <SectionCard
          title="Out of stock but still listed"
          description="These appear in search results a buyer cannot act on."
          className="mb-5"
          padded={false}
        >
          <ul className="divide-y divide-border">
            {outOfStock.map((product) => (
              <li key={product.id} className="flex items-center gap-3 px-5 py-3">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="min-w-0 flex-1 truncate text-[13px] font-medium text-text hover:text-accent-text"
                >
                  {product.name}
                </Link>
                <span className="font-mono text-[11px] text-faint tnum">{product.sku}</span>
                <Badge tone="danger" size="sm" dot>
                  0 units
                </Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface scrollbar-slim">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <caption className="sr-only">
            {pluralize(ordered.length, 'active product')} by stock risk
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
              <th scope="col" className="px-4 py-3 font-semibold">Product</th>
              <th scope="col" className="px-3 py-3 font-semibold">Seller</th>
              <th scope="col" className="px-3 py-3 font-semibold">Availability</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">On hand</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">MOQ</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Lead</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Stock value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ordered.map((product) => {
              const quantity = product.availability.quantityOnHand
              const low = quantity != null && quantity > 0 && quantity <= LOW_STOCK_THRESHOLD

              return (
                <tr key={product.id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-[13px] font-medium text-text hover:text-accent-text"
                    >
                      {product.name}
                    </Link>
                    <p className="font-mono text-[11px] text-faint tnum">
                      {product.sku} · {CATEGORY_BY_ID.get(product.categoryId)?.name ?? '—'} ·{' '}
                      {BRAND_BY_ID.get(product.brandId)?.name ?? '—'}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-[12.5px] text-muted">
                    {SELLER_BY_ID.get(product.sellerId)?.name ?? '—'}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={AVAILABILITY_TONE[product.availability.state]} size="sm" dot>
                      {AVAILABILITY_LABELS[product.availability.state]}
                    </Badge>
                  </td>
                  <td
                    className={cn(
                      'px-3 py-3 text-right font-mono text-[13px] tnum',
                      quantity === 0 ? 'text-danger' : low ? 'text-warning' : 'text-text-2'
                    )}
                  >
                    {quantity ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[13px] text-muted tnum">
                    {product.availability.minOrderQuantity}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[13px] text-muted tnum">
                    {product.availability.leadTimeDays ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-text tnum">
                    {quantity ? formatPrice(product.price * quantity) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
