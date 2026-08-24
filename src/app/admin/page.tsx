import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  Boxes,
  FileText,
  Package,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { buildOverview } from '@/server/admin/analytics'
import { formatCompactINR, formatPercent, formatPrice, pluralize } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { BarChart, PageHeader, SectionCard, ShareBar, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * Admin dashboard.
 *
 * Ordered by what an operator can act on today. The zero-result rate leads
 * because it is the only headline metric that names its own fix — the failing
 * queries are listed right below it, and each one is either a catalogue gap or
 * a synonym missing from the spec registry.
 */
export default async function AdminDashboard() {
  const overview = await buildOverview()
  const { catalogue, people, search, rfq } = overview

  const zeroRateHigh = search.zeroResultRate > 0.05

  return (
    <>
      <PageHeader
        title="Operations"
        description="Catalogue health, demand, and how well search is actually answering buyers."
        action={
          <ButtonLink href="/admin/products/new" leadingIcon={<Package className="size-4" aria-hidden />}>
            Add product
          </ButtonLink>
        }
      />

      {/* Attention ---------------------------------------------------------- */}
      {(zeroRateHigh || rfq.awaitingSupplier > 0) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {rfq.awaitingSupplier > 0 && (
            <Link
              href="/admin/rfq"
              className="flex items-center gap-3 rounded-xl border border-accent-line bg-accent-soft/50 p-4 transition-colors hover:bg-accent-soft"
            >
              <FileText className="size-5 shrink-0 text-accent-text" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">
                  {pluralize(rfq.awaitingSupplier, 'quotation')} awaiting a response
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Median first response is{' '}
                  {rfq.medianResponseHours != null
                    ? `${rfq.medianResponseHours} h`
                    : 'not yet measurable'}
                </p>
              </div>
            </Link>
          )}

          {zeroRateHigh && (
            <Link
              href="/admin/search-analytics"
              className="flex items-center gap-3 rounded-xl border border-warning/25 bg-warning-soft p-4 transition-colors hover:brightness-105"
            >
              <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">
                  {formatPercent(search.zeroResultRate, 1)} of searches return nothing
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Each one is a catalogue gap or a missing synonym
                </p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Headline ----------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Zero-result rate"
          value={formatPercent(search.zeroResultRate, 1)}
          hint={`${search.total} searches recorded`}
          icon={Search}
          href="/admin/search-analytics"
          tone={zeroRateHigh ? 'accent' : 'neutral'}
        />
        <StatCard
          label="Search → quotation"
          value={formatPercent(search.conversionRate, 1)}
          hint={`${pluralize(rfq.total, 'request')} raised`}
          icon={TrendingUp}
          href="/admin/rfq"
        />
        <StatCard
          label="Active products"
          value={catalogue.active}
          hint={`${catalogue.inStock} in stock · ${catalogue.outOfStock} out`}
          icon={Package}
          href="/admin/products"
        />
        <StatCard
          label="Customers"
          value={people.users}
          hint={`${people.activeThisWeek} active this week`}
          icon={Users}
          href="/admin/customers"
        />
      </div>

      {/* Body ---------------------------------------------------------------- */}
      {/* grid-cols-[minmax(0,1fr)] below lg keeps the stacked columns from
          adopting their widest child's intrinsic width on narrow screens. */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <SectionCard title="Search volume" description="Last 14 days">
            <BarChart data={overview.daily} height={140} />

            <div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
              <div>
                <p className="mb-2.5 text-[12px] font-medium text-muted">How buyers searched</p>
                <ShareBar
                  segments={[
                    {
                      label: 'Assistant',
                      value: Math.round(search.aiShare * search.total),
                      className: 'bg-accent',
                    },
                    {
                      label: 'Keyword',
                      value: search.total - Math.round(search.aiShare * search.total),
                      className: 'bg-surface-3',
                    },
                  ]}
                />
              </div>

              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Last 7 days</dt>
                  <dd className="font-mono text-text tnum">{search.last7Days}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Last 30 days</dt>
                  <dd className="font-mono text-text tnum">{search.last30Days}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Median latency</dt>
                  <dd className="font-mono text-text tnum">{search.medianTookMs} ms</dd>
                </div>
              </dl>
            </div>
          </SectionCard>

          {/* Failing queries ------------------------------------------------ */}
          <SectionCard
            title="Queries returning nothing"
            description="The highest-value list on this page — each row is a buyer who left"
            action={
              <Link
                href="/admin/search-analytics"
                className="text-[13px] font-medium text-accent-text hover:underline"
              >
                All queries
              </Link>
            }
            padded={overview.failedQueries.length === 0}
          >
            {overview.failedQueries.length === 0 ? (
              <p className="text-[13px] text-muted">
                No search has returned zero results. That is the number to keep at zero.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {overview.failedQueries.map((stat) => (
                  <li
                    key={stat.query}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                      {stat.query}
                    </span>
                    <Badge tone="warning" size="sm">
                      {stat.zeroCount} of {stat.count} empty
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Top products ---------------------------------------------------- */}
          <SectionCard
            title="Most in demand"
            description="Ranked by quotation quantity and search click-through"
            action={
              <Link
                href="/admin/products"
                className="text-[13px] font-medium text-accent-text hover:underline"
              >
                Catalogue
              </Link>
            }
            padded={overview.topProducts.length === 0}
          >
            {overview.topProducts.length === 0 ? (
              <p className="text-[13px] text-muted">
                No product has been opened from a search or quoted yet.
              </p>
            ) : (
              <div className="overflow-x-auto scrollbar-slim">
                <table className="w-full min-w-[30rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Product</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Opened</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Quoted qty</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overview.topProducts.map(({ product, views, rfqs }) => (
                      <tr key={product.id}>
                        <td className="px-5 py-2.5">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="text-[13px] font-medium text-text hover:text-accent-text"
                          >
                            {product.name}
                          </Link>
                          <p className="font-mono text-[11px] text-faint tnum">{product.sku}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[13px] text-text-2 tnum">
                          {views}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[13px] text-text-2 tnum">
                          {rfqs || '—'}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-[13px] text-text tnum">
                          {formatPrice(product.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Sidebar --------------------------------------------------------- */}
        <div className="min-w-0 space-y-6">
          <SectionCard title="Quotation pipeline">
            <dl className="space-y-3 text-[13px]">
              {[
                { label: 'Total raised', value: String(rfq.total) },
                { label: 'Open', value: String(rfq.open) },
                { label: 'Awaiting supplier', value: String(rfq.awaitingSupplier) },
                { label: 'Quoted', value: String(rfq.quoted) },
                {
                  label: 'Quoted value',
                  value: rfq.quotedValue > 0 ? formatCompactINR(rfq.quotedValue) : '—',
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="font-mono text-text tnum">{row.value}</dd>
                </div>
              ))}
            </dl>
            <ButtonLink href="/admin/rfq" variant="secondary" size="sm" fullWidth className="mt-4">
              Manage quotations
            </ButtonLink>
          </SectionCard>

          <SectionCard
            title="Most searched categories"
            description="From parsed intents"
            padded={overview.topCategories.length === 0}
          >
            {overview.topCategories.length === 0 ? (
              <p className="text-[13px] text-muted">No categorised searches yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {overview.topCategories.map((category) => {
                  const max = overview.topCategories[0]?.searches ?? 1
                  return (
                    <li key={category.key} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text-2">
                        {category.name}
                      </span>
                      <span
                        className="h-1.5 shrink-0 rounded-full bg-accent/60"
                        style={{ width: `${Math.max(6, (category.searches / max) * 56)}px` }}
                        aria-hidden
                      />
                      <span className="w-6 shrink-0 text-right font-mono text-[12px] text-muted tnum">
                        {category.searches}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Catalogue health">
            <dl className="space-y-3 text-[13px]">
              {[
                { label: 'Total products', value: String(catalogue.total), tone: 'neutral' },
                { label: 'Active', value: String(catalogue.active), tone: 'neutral' },
                { label: 'In stock', value: String(catalogue.inStock), tone: 'success' },
                { label: 'Made to order', value: String(catalogue.madeToOrder), tone: 'info' },
                { label: 'Out of stock', value: String(catalogue.outOfStock), tone: 'danger' },
                { label: 'Average price', value: formatPrice(catalogue.averagePrice), tone: 'neutral' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <dt className="text-muted">{row.label}</dt>
                  <dd
                    className={cn(
                      'font-mono tnum',
                      row.tone === 'danger' && Number(row.value) > 0 ? 'text-danger' : 'text-text'
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <ButtonLink
              href="/admin/inventory"
              variant="secondary"
              size="sm"
              fullWidth
              className="mt-4"
              leadingIcon={<Boxes className="size-3.5" aria-hidden />}
            >
              Inventory
            </ButtonLink>
          </SectionCard>

          <SectionCard title="Engine">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4 text-accent-text" aria-hidden />
              <p className="text-[13px] text-text-2">
                Ranking weights and intent quality
              </p>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Search quality is a tunable product parameter here, not a hidden
              constant. The weight model and a live intent inspector are on the
              ranking page.
            </p>
            <ButtonLink href="/admin/ai" variant="secondary" size="sm" fullWidth className="mt-3">
              Ranking &amp; AI
            </ButtonLink>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
