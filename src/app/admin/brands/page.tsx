import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, ShieldCheck, Timer } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getAdminRepository, getCatalogRepository } from '@/server/repositories'
import { formatCompactINR, formatPercent, formatPrice, pluralize } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { PageHeader, SectionCard, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Brands & sellers' }

/**
 * Brands and sellers.
 *
 * Seller reliability is not decoration here — `fulfilmentRate` and
 * `responseHours` feed the `sellerTrust` component of the ranking model, so a
 * seller who stops responding gradually loses placement. Surfacing the inputs
 * next to the outcome is the point of this page.
 */
export default async function AdminBrandsPage() {
  await requireRole('staff', '/admin/brands')

  const catalog = getCatalogRepository()
  const admin = getAdminRepository()

  const [brands, sellers, products, rfqs] = await Promise.all([
    catalog.brands(),
    catalog.sellers(),
    catalog.listAll(),
    admin.listAllRfqs(300),
  ])

  const active = products.filter((product) => product.status === 'active')

  const bySeller = new Map<string, typeof active>()
  for (const product of active) {
    const list = bySeller.get(product.sellerId) ?? []
    list.push(product)
    bySeller.set(product.sellerId, list)
  }

  // Quotation volume per seller, resolved through the products on each line.
  const productSeller = new Map(products.map((product) => [product.id, product.sellerId]))
  const rfqBySeller = new Map<string, number>()
  for (const rfq of rfqs) {
    for (const item of rfq.items) {
      const sellerId = productSeller.get(item.productId)
      if (!sellerId) continue
      rfqBySeller.set(sellerId, (rfqBySeller.get(sellerId) ?? 0) + 1)
    }
  }

  const verified = sellers.filter((seller) => seller.verified)

  return (
    <>
      <PageHeader
        title="Brands &amp; sellers"
        description="Who supplies the catalogue, and how their reliability feeds the ranking model."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Brands" value={brands.length} />
        <StatCard label="Sellers" value={sellers.length} />
        <StatCard
          label="Verified sellers"
          value={verified.length}
          hint={`${sellers.length - verified.length} unverified`}
          icon={ShieldCheck}
          tone={verified.length < sellers.length ? 'accent' : 'neutral'}
        />
        <StatCard
          label="Median response"
          value={`${Math.round(
            sellers.reduce((sum, seller) => sum + seller.responseHours, 0) /
              Math.max(1, sellers.length)
          )} h`}
          hint="Feeds sellerTrust"
          icon={Timer}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sellers -------------------------------------------------------- */}
        <SectionCard
          title="Sellers"
          description="Fulfilment rate and response time both feed the ranking model."
          padded={false}
        >
          <ul className="divide-y divide-border">
            {sellers.map((seller) => {
              const catalogueSize = bySeller.get(seller.id)?.length ?? 0
              const value = (bySeller.get(seller.id) ?? []).reduce(
                (sum, product) =>
                  sum + product.price * (product.availability.quantityOnHand ?? 0),
                0
              )

              return (
                <li key={seller.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-text">
                        {seller.name}
                        {seller.verified && (
                          <ShieldCheck className="size-3.5 text-success" aria-label="Verified" />
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                        <MapPin className="size-3" aria-hidden />
                        {seller.city}, {seller.state} · since {seller.since}
                      </p>
                    </div>

                    <Badge tone={seller.verified ? 'success' : 'warning'} size="sm">
                      {seller.verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-4">
                    <div>
                      <dt className="text-faint">Products</dt>
                      <dd className="font-mono text-text-2 tnum">{catalogueSize}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Quote lines</dt>
                      <dd className="font-mono text-text-2 tnum">
                        {rfqBySeller.get(seller.id) ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-faint">Fulfilment</dt>
                      <dd
                        className={cn(
                          'font-mono tnum',
                          seller.fulfilmentRate < 0.9 ? 'text-warning' : 'text-success'
                        )}
                      >
                        {formatPercent(seller.fulfilmentRate, 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-faint">Responds in</dt>
                      <dd
                        className={cn(
                          'font-mono tnum',
                          seller.responseHours > 8 ? 'text-warning' : 'text-text-2'
                        )}
                      >
                        ~{seller.responseHours} h
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-2.5 font-mono text-[11px] text-faint tnum">
                    GSTIN {seller.gstin}
                    {value > 0 && ` · stock ${formatCompactINR(value)}`}
                  </p>
                </li>
              )
            })}
          </ul>
        </SectionCard>

        {/* Brands --------------------------------------------------------- */}
        <SectionCard title="Brands" description="Manufacturers represented in the catalogue." padded={false}>
          <ul className="divide-y divide-border">
            {[...brands]
              .sort((a, b) => b.productCount - a.productCount)
              .map((brand) => {
                const brandProducts = active.filter((product) => product.brandId === brand.id)
                const prices = brandProducts.map((product) => product.price)

                return (
                  <li key={brand.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-text">{brand.name}</p>
                        <p className="mt-0.5 text-[12px] text-muted">{brand.country}</p>
                      </div>
                      <Link
                        href={`/admin/products?q=${encodeURIComponent(brand.name)}`}
                        className="shrink-0 text-[12px] font-medium text-accent-text hover:underline"
                      >
                        {pluralize(brand.productCount, 'product')}
                      </Link>
                    </div>

                    <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted">
                      {brand.description}
                    </p>

                    {prices.length > 0 && (
                      <p className="mt-2 font-mono text-[11px] text-faint tnum">
                        {formatPrice(Math.min(...prices))} – {formatPrice(Math.max(...prices))}
                      </p>
                    )}
                  </li>
                )
              })}
          </ul>
        </SectionCard>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-faint">
        Brands and sellers are fictional demo data defined in{' '}
        <code className="font-mono">src/server/seed/taxonomy.ts</code>. A seller
        portal is not built — every product already carries a{' '}
        <code className="font-mono">sellerId</code>, so adding one needs no
        migration.
      </p>
    </>
  )
}
