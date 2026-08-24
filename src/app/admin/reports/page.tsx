import type { Metadata } from 'next'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getAdminRepository, getCatalogRepository } from '@/server/repositories'
import { buildOverview } from '@/server/admin/analytics'
import { CATEGORY_BY_ID } from '@/server/seed/taxonomy'
import {
  formatCompactINR,
  formatPercent,
  formatPrice,
  pluralize,
} from '@/lib/format'
import { BarChart, PageHeader, SectionCard, ShareBar, StatCard } from '@/components/account/ui'
import { Badge } from '@/components/ui/badge'
import {
  EXPORT_DESCRIPTIONS,
  EXPORT_KINDS,
  EXPORT_LABELS,
} from '@/server/export/reports'

export const metadata: Metadata = { title: 'Reports' }

/**
 * Reports.
 *
 * Aggregates the numbers an operator would otherwise assemble by hand, and is
 * explicit about the denominator on each one — a conversion rate with an
 * unstated base is a number people argue about rather than act on.
 */
export default async function AdminReportsPage() {
  const user = await requireRole('staff', '/admin/reports')

  const [overview, products, rfqs] = await Promise.all([
    buildOverview(),
    getCatalogRepository().listAll(),
    getAdminRepository().listAllRfqs(500),
  ])

  const active = products.filter((product) => product.status === 'active')

  /* --- Catalogue mix by category --------------------------------------- */
  const byCategory = new Map<string, { name: string; count: number; value: number }>()
  for (const product of active) {
    const name = CATEGORY_BY_ID.get(product.categoryId)?.name ?? 'Unclassified'
    const entry = byCategory.get(product.categoryId) ?? { name, count: 0, value: 0 }
    entry.count += 1
    entry.value += product.price
    byCategory.set(product.categoryId, entry)
  }

  const categoryRows = [...byCategory.values()].sort((a, b) => b.count - a.count)

  /* --- Price bands ------------------------------------------------------ */
  const bands = [
    { label: 'Under ₹1,000', test: (p: number) => p < 1_000 },
    { label: '₹1,000 – ₹5,000', test: (p: number) => p >= 1_000 && p < 5_000 },
    { label: '₹5,000 – ₹25,000', test: (p: number) => p >= 5_000 && p < 25_000 },
    { label: '₹25,000 – ₹1L', test: (p: number) => p >= 25_000 && p < 100_000 },
    { label: 'Over ₹1L', test: (p: number) => p >= 100_000 },
  ].map((band) => ({
    label: band.label,
    value: active.filter((product) => band.test(product.price)).length,
  }))

  const bandColours = ['bg-accent', 'bg-success', 'bg-info', 'bg-warning', 'bg-surface-3']

  /* --- RFQ funnel ------------------------------------------------------- */
  const funnel = [
    { label: 'Searches', value: overview.search.total },
    {
      label: 'With a click',
      value: overview.topQueries.reduce(
        (sum, stat) => sum + Math.round(stat.clickThrough * stat.count),
        0
      ),
    },
    { label: 'Quotations raised', value: rfqs.length },
    { label: 'Quoted back', value: rfqs.filter((rfq) => rfq.quotedTotal != null).length },
  ]

  const quotedValue = rfqs.reduce((sum, rfq) => sum + (rfq.quotedTotal ?? 0), 0)
  const averageQuote =
    rfqs.filter((rfq) => rfq.quotedTotal != null).length > 0
      ? Math.round(quotedValue / rfqs.filter((rfq) => rfq.quotedTotal != null).length)
      : 0

  return (
    <>
      <PageHeader
        title="Reports"
        description="Catalogue mix, demand and the search-to-quotation funnel. Every figure states its denominator."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Catalogue value"
          value={formatCompactINR(active.reduce((sum, p) => sum + p.price, 0))}
          hint={`Sum of ${pluralize(active.length, 'active list price')}`}
        />
        <StatCard
          label="Average quote"
          value={averageQuote > 0 ? formatPrice(averageQuote) : '—'}
          hint={`Across ${rfqs.filter((r) => r.quotedTotal != null).length} quoted requests`}
        />
        <StatCard
          label="Assistant share"
          value={formatPercent(overview.search.aiShare, 0)}
          hint={`Of ${pluralize(overview.search.total, 'search')}`}
        />
        <StatCard
          label="Zero-result rate"
          value={formatPercent(overview.search.zeroResultRate, 1)}
          hint={`Of ${pluralize(overview.search.total, 'search')}`}
          tone={overview.search.zeroResultRate > 0.05 ? 'accent' : 'neutral'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Search-to-quotation funnel"
          description="Where demand is lost between a query and a request"
        >
          <ul className="space-y-3">
            {funnel.map((step, index) => {
              const base = funnel[0]?.value ?? 1
              const share = base > 0 ? step.value / base : 0
              return (
                <li key={step.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="text-text-2">{step.label}</span>
                    <span className="font-mono text-text tnum">
                      {step.value}
                      {index > 0 && (
                        <span className="ml-2 text-[11px] text-faint">
                          {formatPercent(share, 1)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(2, share * 100)}%` }}
                      aria-hidden
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-[12px] leading-relaxed text-faint">
            The click step is derived from per-query click-through, so it is an
            estimate rather than a distinct count. Named as such rather than
            presented as exact.
          </p>
        </SectionCard>

        <SectionCard title="Search volume" description="Last 14 days">
          <BarChart data={overview.daily} height={150} />
        </SectionCard>

        <SectionCard title="Catalogue by category" padded={false}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                <th scope="col" className="px-5 py-2.5 font-semibold">Category</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Products</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Share</th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">Avg price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categoryRows.map((row) => (
                <tr key={row.name}>
                  <td className="px-5 py-2.5 text-[13px] text-text-2">{row.name}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px] text-text tnum">
                    {row.count}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-muted tnum">
                    {formatPercent(row.count / Math.max(1, active.length), 0)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-[13px] text-muted tnum">
                    {formatPrice(Math.round(row.value / row.count))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Price distribution" description={`${pluralize(active.length, 'active product')}`}>
          <ShareBar
            segments={bands.map((band, index) => ({
              label: band.label,
              value: band.value,
              className: bandColours[index] ?? 'bg-surface-3',
            }))}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Export"
        description="CSV, UTF-8, opens directly in Excel"
        className="mt-6"
        padded={false}
      >
        <ul className="divide-y divide-border">
          {EXPORT_KINDS.map((kind) => {
            // Customer contact details are a step above catalogue data. The
            // endpoint enforces this too — the guard here only avoids showing
            // staff a link that would 404 for them.
            const adminOnly = kind === 'customers'
            if (adminOnly && user.role !== 'admin') return null

            return (
              <li
                key={kind}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-text">
                    {EXPORT_LABELS[kind]}
                    {adminOnly && (
                      <Badge tone="warning" size="sm" className="ml-2 align-middle">
                        Admin only
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                    {EXPORT_DESCRIPTIONS[kind]}
                  </p>
                </div>

                {/*
                  A plain link, not a fetch. The browser already knows how to
                  stream a Content-Disposition response to disk; recreating
                  that with a blob would buffer the whole file in memory first.
                  `download` is a hint — the header is what decides.
                */}
                <a
                  href={`/api/admin/export/${kind}`}
                  download
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-text-2 transition-colors hover:border-accent hover:text-text"
                >
                  <Download className="size-3.5" aria-hidden />
                  Download
                </a>
              </li>
            )
          })}
        </ul>

        <p className="border-t border-border px-5 py-3 text-[12px] leading-relaxed text-faint">
          Capped at 20,000 rows per file, and every download is written to the{' '}
          <Link href="/admin/audit" className="text-accent-text hover:underline">
            audit trail
          </Link>{' '}
          with the account that requested it.
        </p>
      </SectionCard>
    </>
  )
}
