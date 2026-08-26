import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronRight,
  Download,
  FileText,
  Info,
  MapPin,
  Package,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import { getCatalogRepository } from '@/server/repositories'
import { cachedProductBySlug, cachedRelatedProducts } from '@/server/catalog/cached-search'
import { groupedSpecs, highlightSpecs, specLabel } from '@/server/catalog/highlights'
import { parseIntentOffline } from '@/server/ai/intent-offline'
import { applicationLabel, industryLabel } from '@/server/catalog/spec-registry'
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONE,
  discountPercent,
  formatDate,
  formatLeadTime,
  formatNumber,
  formatPrice,
  formatWarranty,
  pluralize,
} from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MatchExplanationPanel } from '@/components/ui/match-score'
import { ProductGallery } from '@/components/catalog/product-gallery'
import { ProductDetailActions } from '@/components/catalog/product-detail-actions'
import { ProductCard } from '@/components/catalog/product-card'
import { ViewTracker } from '@/components/catalog/view-tracker'

/**
 * Product detail.
 *
 * Statically generated for every product; the "why this is recommended" panel
 * renders only when the page was reached from a search (`?q=`), in which case
 * it re-scores this product against that intent and shows the same criteria
 * table the ranking produced. Asserting a recommendation to someone who never
 * asked for one would be noise.
 */

export async function generateStaticParams() {
  const slugs = await getCatalogRepository().allSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await cachedProductBySlug(slug)
  if (!product) return { title: 'Product not found' }

  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      type: 'website',
    },
    alternates: { canonical: `/products/${product.slug}` },
  }
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { slug } = await params
  const { q } = await searchParams

  const product = await cachedProductBySlug(slug)
  if (!product) notFound()

  const [related, explained] = await Promise.all([
    cachedRelatedProducts(product.id, 4),
    q
      ? getCatalogRepository().explain(product.id, parseIntentOffline(q))
      : Promise.resolve(null),
  ])

  const groups = groupedSpecs(product)
  const discount = discountPercent(product.price, product.listPrice)
  const { availability } = product

  return (
    <div className="container-page py-8 lg:py-12">
      <ViewTracker productId={product.id} />
      {/* Breadcrumb -------------------------------------------------------- */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          <li>
            <Link href="/" className="hover:text-text">
              Home
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li>
            <Link href="/products" className="hover:text-text">
              Products
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li>
            <Link href={`/categories/${product.category.slug}`} className="hover:text-text">
              {product.category.name}
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li aria-current="page" className="max-w-[16rem] truncate text-text">
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Primary ----------------------------------------------------------- */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductGallery images={product.images} productName={product.name} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/products?brand=${product.brand.key}`}
              className="text-[12px] font-semibold tracking-wide text-accent-text uppercase hover:underline"
            >
              {product.brand.name}
            </Link>
            <span className="font-mono text-[12px] text-faint tnum">{product.sku}</span>
            {product.rating && (
              <span className="text-[12px] text-muted">
                {product.rating.average.toFixed(1)} ·{' '}
                {pluralize(product.rating.count, 'review')}
              </span>
            )}
          </div>

          <h1 className="mt-2.5 font-display text-2xl leading-tight font-semibold tracking-tight md:text-[2rem]">
            {product.name}
          </h1>

          <p className="mt-3.5 text-[15px] leading-relaxed text-muted">
            {product.shortDescription}
          </p>

          {/* Price ---------------------------------------------------------- */}
          <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2 border-y border-border py-5">
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-3xl font-semibold text-text tnum">
                  {formatPrice(product.price)}
                </span>
                {product.listPrice != null && product.listPrice > product.price && (
                  <span className="font-mono text-sm text-faint line-through tnum">
                    {formatPrice(product.listPrice)}
                  </span>
                )}
                {discount != null && (
                  <Badge tone="accent" size="md">
                    {discount}% off
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[12px] text-faint">
                {product.priceUnit} · excl. {product.taxRatePercent}% GST · MOQ{' '}
                {availability.minOrderQuantity} {availability.unit}
                {availability.minOrderQuantity === 1 ? '' : 's'}
              </p>
            </div>

            <div className="ml-auto text-right">
              <Badge tone={AVAILABILITY_TONE[availability.state]} dot size="md">
                {AVAILABILITY_LABELS[availability.state]}
              </Badge>
              <p className="mt-1.5 text-[12px] text-muted">
                {formatLeadTime(availability.leadTimeDays)}
                {availability.quantityOnHand != null && availability.quantityOnHand > 0 && (
                  <> · {formatNumber(availability.quantityOnHand)} available</>
                )}
              </p>
            </div>
          </div>

          {/* Actions -------------------------------------------------------- */}
          <div className="mt-6">
            <ProductDetailActions
              productId={product.id}
              productName={product.name}
              sellerName={product.seller.name}
            />
          </div>

          {/* Why recommended ------------------------------------------------ */}
          {explained && (
            <div className="mt-7">
              <MatchExplanationPanel
                explanation={explained.explanation}
                title="Why this is recommended for you"
              />
              <p className="mt-2 px-1 text-[11px] text-faint">
                Scored against your search: “{q}”
              </p>
            </div>
          )}

          {/* Key specs ------------------------------------------------------ */}
          <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            {highlightSpecs(product, 6).map((spec) => (
              <div key={spec.key} className="bg-surface px-3.5 py-3">
                <dt className="text-[11px] tracking-wide text-faint uppercase">
                  {specLabel(spec.key)}
                </dt>
                <dd className="mt-1 font-mono text-[13px] font-medium text-text tnum">
                  {spec.displayValue}
                </dd>
              </div>
            ))}
          </dl>

          {/* Seller --------------------------------------------------------- */}
          <Card className="mt-4" elevation="flat">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-muted">
                <Package className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                  {product.seller.name}
                  {product.seller.verified && (
                    <ShieldCheck className="size-3.5 text-success" aria-label="Verified seller" />
                  )}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" aria-hidden />
                    {product.seller.city}, {product.seller.state}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3" aria-hidden />
                    Responds in ~{product.seller.responseHours} h
                  </span>
                  <span className="font-mono tnum">
                    {Math.round(product.seller.fulfilmentRate * 100)}% fulfilment
                  </span>
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Detail sections ---------------------------------------------------- */}
      {/* grid-cols-[minmax(0,1fr)] below lg: the implicit column otherwise
          sizes to the widest child's intrinsic width, which pushes this page
          past narrow viewports. */}
      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-10 lg:mt-20 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0 space-y-12">
          {/* Description -------------------------------------------------- */}
          <section aria-labelledby="description-heading">
            <h2
              id="description-heading"
              className="font-display text-xl font-semibold tracking-tight"
            >
              Description
            </h2>
            <p className="mt-4 text-[15px] leading-[1.75] text-text-2">{product.description}</p>
          </section>

          {/* Specifications ------------------------------------------------ */}
          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="font-display text-xl font-semibold tracking-tight">
              Technical specifications
            </h2>

            <div className="mt-4 space-y-6">
              {groups.map((group) => (
                <div key={group.group}>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
                    {group.label}
                  </h3>
                  <table className="w-full border-collapse overflow-hidden rounded-lg border border-border">
                    <tbody className="divide-y divide-border">
                      {group.specs.map((spec, index) => (
                        <tr key={spec.key} className={index % 2 === 1 ? 'bg-surface-2/50' : ''}>
                          <th
                            scope="row"
                            className="w-1/2 px-4 py-2.5 text-left text-[13px] font-medium text-muted"
                          >
                            {specLabel(spec.key)}
                          </th>
                          <td className="px-4 py-2.5 font-mono text-[13px] text-text tnum">
                            {spec.displayValue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          {/* Applications --------------------------------------------------- */}
          {(product.applications.length > 0 || product.industries.length > 0) && (
            <section aria-labelledby="applications-heading">
              <h2
                id="applications-heading"
                className="font-display text-xl font-semibold tracking-tight"
              >
                Applications
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {product.applications.map((key) => (
                  <Link key={key} href={`/products?app=${key}`}>
                    <Badge tone="neutral" size="md" className="hover:border-accent-line">
                      {applicationLabel(key)}
                    </Badge>
                  </Link>
                ))}
                {product.industries.map((key) => (
                  <Badge key={key} tone="neutral" size="md">
                    {industryLabel(key)}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar --------------------------------------------------------- */}
        <aside className="min-w-0 space-y-6">
          {/* Documents ----------------------------------------------------- */}
          <section aria-labelledby="documents-heading">
            <h2
              id="documents-heading"
              className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase"
            >
              Documents
            </h2>
            <ul className="space-y-2">
              {product.documents.map((document) => (
                <li key={document.id}>
                  <a
                    href={document.url}
                    className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-text">
                        {document.title}
                      </span>
                      <span className="font-mono text-[11px] text-faint tnum">
                        {document.format} · {document.sizeKb} KB
                      </span>
                    </span>
                    <Download
                      className="size-4 shrink-0 text-faint transition-colors group-hover:text-accent"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-faint">
              <Info className="mt-px size-3 shrink-0" aria-hidden />
              Demo catalogue — document links are placeholders.
            </p>
          </section>

          {/* Compliance ----------------------------------------------------- */}
          {product.certifications.length > 0 && (
            <section aria-labelledby="compliance-heading">
              <h2
                id="compliance-heading"
                className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase"
              >
                Standards & compliance
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {product.certifications.map((certification) => (
                  <Badge key={certification} tone="success" size="md">
                    {certification}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Commercial ----------------------------------------------------- */}
          <section aria-labelledby="commercial-heading">
            <h2
              id="commercial-heading"
              className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase"
            >
              Commercial
            </h2>
            <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {[
                { label: 'Warranty', value: formatWarranty(product.warrantyMonths) },
                { label: 'Minimum order', value: `${availability.minOrderQuantity} ${availability.unit}` },
                { label: 'Lead time', value: formatLeadTime(availability.leadTimeDays) },
                { label: 'GST', value: `${product.taxRatePercent}%` },
                { label: 'Listed', value: formatDate(product.createdAt) },
                { label: 'Updated', value: formatDate(product.updatedAt) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <dt className="text-[13px] text-muted">{row.label}</dt>
                  <dd className="font-mono text-[13px] text-text tnum">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>

      {/* Related ------------------------------------------------------------ */}
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-16 border-t border-border pt-12 lg:mt-24">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2
                id="related-heading"
                className="font-display text-2xl font-semibold tracking-tight"
              >
                Frequently specified together
              </h2>
              <p className="mt-2 text-[15px] text-muted">
                Products that appear alongside this one in the same installations.
              </p>
            </div>
            <Link
              href={`/categories/${product.category.slug}`}
              className="hidden shrink-0 text-sm font-medium text-accent-text hover:underline sm:block"
            >
              All {product.category.name.toLowerCase()}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} highlights={highlightSpecs(item, 3)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
