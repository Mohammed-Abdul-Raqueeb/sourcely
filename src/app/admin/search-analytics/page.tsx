import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Search, Sparkles, TrendingUp } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getAdminRepository } from '@/server/repositories'
import { buildOverview } from '@/server/admin/analytics'
import { formatPercent, formatRelative, pluralize } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { StateBlock } from '@/components/ui/states'
import { BarChart, PageHeader, SectionCard, ShareBar, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Search analytics' }

/**
 * Search analytics.
 *
 * Built around one question: which searches are failing, and why. Volume and
 * latency are context; the failing-query list is the work.
 *
 * A zero-result query is one of two things, and the row tells you which:
 * either the catalogue genuinely has no such product (a sourcing gap), or the
 * parser did not recognise the vocabulary (a missing synonym in the spec
 * registry). The parsed-intent column is what separates them.
 */
export default async function SearchAnalyticsPage() {
  await requireRole('staff', '/admin/search-analytics')

  const [overview, events] = await Promise.all([
    buildOverview(),
    getAdminRepository().listAllSearchEvents(120),
  ])

  const { search } = overview
  const aiCount = Math.round(search.aiShare * search.total)

  const lowConfidence = events.filter(
    (event) => event.intent != null && event.intent.confidence < 0.5
  )

  return (
    <>
      <PageHeader
        title="Search analytics"
        description="What buyers asked for, what came back, and where the engine fell short."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Zero-result rate"
          value={formatPercent(search.zeroResultRate, 1)}
          hint="Every point here is a buyer who left"
          icon={AlertTriangle}
          tone={search.zeroResultRate > 0.05 ? 'accent' : 'neutral'}
        />
        <StatCard
          label="Searches"
          value={search.total}
          hint={`${search.last7Days} in the last 7 days`}
          icon={Search}
        />
        <StatCard
          label="Assistant share"
          value={formatPercent(search.aiShare, 0)}
          hint={`${aiCount} of ${search.total}`}
          icon={Sparkles}
        />
        <StatCard
          label="Search → quotation"
          value={formatPercent(search.conversionRate, 1)}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionCard title="Volume" description="Last 14 days">
            <BarChart data={overview.daily} height={130} />
          </SectionCard>

          {/* Failing queries -------------------------------------------------- */}
          <SectionCard
            title="Queries that returned nothing"
            description="Each is either a catalogue gap or a missing synonym"
            padded={overview.failedQueries.length === 0}
          >
            {overview.failedQueries.length === 0 ? (
              <p className="text-[13px] text-muted">
                No search has returned zero results.
              </p>
            ) : (
              <div className="overflow-x-auto scrollbar-slim">
                <table className="w-full min-w-[30rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Query</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Runs</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">Empty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overview.failedQueries.map((stat) => (
                      <tr key={stat.query}>
                        <td className="px-5 py-2.5">
                          <Link
                            href={`/assistant?q=${encodeURIComponent(stat.query)}`}
                            className="text-[13px] text-text hover:text-accent-text"
                          >
                            {stat.query}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[13px] text-muted tnum">
                          {stat.count}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <Badge tone="warning" size="sm">
                            {stat.zeroCount}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Top queries ------------------------------------------------------ */}
          <SectionCard
            title="Most frequent queries"
            description="Click-through is the honest quality signal — a query with results but no clicks did not answer the question"
            padded={overview.topQueries.length === 0}
          >
            {overview.topQueries.length === 0 ? (
              <p className="text-[13px] text-muted">No searches recorded yet.</p>
            ) : (
              <div className="overflow-x-auto scrollbar-slim">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Query</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Runs</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Avg results</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">AI</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">Click-through</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overview.topQueries.map((stat) => (
                      <tr key={stat.query}>
                        <td className="max-w-[22rem] truncate px-5 py-2.5 text-[13px] text-text-2">
                          {stat.query}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[13px] text-text tnum">
                          {stat.count}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[13px] text-muted tnum">
                          {stat.averageResults}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] text-faint tnum">
                          {formatPercent(stat.aiShare, 0)}
                        </td>
                        <td
                          className={cn(
                            'px-5 py-2.5 text-right font-mono text-[13px] tnum',
                            stat.clickThrough === 0 ? 'text-warning' : 'text-success'
                          )}
                        >
                          {formatPercent(stat.clickThrough, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Recent stream ----------------------------------------------------- */}
          <SectionCard
            title="Recent searches"
            description="Live stream, newest first"
            padded={events.length === 0}
          >
            {events.length === 0 ? (
              <StateBlock
                title="No searches recorded"
                description="Run a search on the storefront and it appears here."
                primaryAction={{ label: 'Open the assistant', href: '/assistant' }}
                compact
              />
            ) : (
              <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto scrollbar-slim">
                {events.slice(0, 60).map((event) => (
                  <li key={event.id} className="flex items-start gap-3 px-5 py-2.5">
                    <span
                      className={cn(
                        'mt-0.5 grid size-6 shrink-0 place-items-center rounded border',
                        event.mode === 'ai'
                          ? 'border-accent-line bg-accent-soft text-accent-text'
                          : 'border-border bg-surface-2 text-muted'
                      )}
                      aria-hidden
                    >
                      {event.mode === 'ai' ? (
                        <Sparkles className="size-3" />
                      ) : (
                        <Search className="size-3" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-text-2">{event.query}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-faint">
                        <span>{formatRelative(event.createdAt)}</span>
                        <span className="font-mono tnum">{event.tookMs} ms</span>
                        {event.intent && (
                          <span className="font-mono tnum">
                            confidence {event.intent.confidence}
                          </span>
                        )}
                        {event.intent?.categoryKeys.length ? (
                          <span>{event.intent.categoryKeys.join(', ')}</span>
                        ) : null}
                      </p>
                    </div>

                    <Badge
                      tone={event.resultCount === 0 ? 'warning' : 'neutral'}
                      size="sm"
                      className="shrink-0"
                    >
                      {event.resultCount}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Sidebar ---------------------------------------------------------- */}
        <div className="space-y-6">
          <SectionCard title="Search mode">
            <ShareBar
              segments={[
                { label: 'Assistant', value: aiCount, className: 'bg-accent' },
                {
                  label: 'Keyword',
                  value: search.total - aiCount,
                  className: 'bg-surface-3',
                },
              ]}
            />
            <p className="mt-4 border-t border-border pt-3 text-[12px] leading-relaxed text-muted">
              A rising assistant share is the signal that buyers trust it with
              requirements they cannot phrase as keywords.
            </p>
          </SectionCard>

          <SectionCard
            title="Most searched categories"
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
                        style={{ width: `${Math.max(6, (category.searches / max) * 52)}px` }}
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

          <SectionCard title="Low-confidence parses">
            {lowConfidence.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-muted">
                No parse fell below 0.5 confidence. That is the number to watch
                after adding a category — it drops before the zero-result rate does.
              </p>
            ) : (
              <ul className="space-y-2">
                {lowConfidence.slice(0, 6).map((event) => (
                  <li key={event.id} className="text-[12.5px]">
                    <p className="truncate text-text-2">{event.query}</p>
                    <p className="font-mono text-[11px] text-warning tnum">
                      confidence {event.intent?.confidence}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Performance">
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Median latency</dt>
                <dd className="font-mono text-text tnum">{search.medianTookMs} ms</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Searches recorded</dt>
                <dd className="font-mono text-text tnum">{pluralize(search.total, 'row')}</dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-border pt-3 text-[12px] leading-relaxed text-faint">
              Median, not mean — one cold start should not move a number an
              operator uses to judge whether search feels fast.
            </p>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
