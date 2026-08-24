import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Bell, Search, Sparkles } from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository } from '@/server/repositories'
import { formatRelative, pluralize } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, SectionCard } from '@/components/account/ui'
import { ClearHistoryButton, SavedSearchControls } from '@/components/account/actions'

export const metadata: Metadata = { title: 'Search history' }

/**
 * Search history and saved searches.
 *
 * Every row is a live link back into the search that produced it, with the
 * original mode preserved — an assistant query reopens in the assistant, a
 * keyword query reopens in the catalogue. History that cannot be replayed is
 * a log file, not a feature.
 */
export default async function SearchesPage() {
  const user = await requireUser('/account/searches')
  const activity = getActivityRepository()

  const [history, savedSearches] = await Promise.all([
    activity.listSearchHistory(user.id, 60),
    activity.listSavedSearches(user.id),
  ])

  const aiCount = history.filter((event) => event.mode === 'ai').length
  const converted = history.filter((event) => event.convertedToRfq).length

  return (
    <>
      <PageHeader
        title="Search history"
        description={
          history.length > 0
            ? `${pluralize(history.length, 'search')} · ${aiCount} with the assistant · ${converted} led to a quotation`
            : 'Every search you run is kept here so you can pick up where you left off.'
        }
        action={<ClearHistoryButton disabled={history.length === 0} />}
      />

      <div className="space-y-6">
        {/* Saved searches ------------------------------------------------- */}
        <SectionCard
          title="Saved searches"
          description="Turn on alerts and we will tell you when new products match."
          padded={savedSearches.length === 0}
        >
          {savedSearches.length === 0 ? (
            <p className="text-[13px] text-muted">
              Save a search from the assistant and it will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {savedSearches.map((search) => (
                <li key={search.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/assistant?q=${encodeURIComponent(search.query)}`}
                      className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-text hover:text-accent-text"
                    >
                      {search.title}
                      <ArrowUpRight
                        className="size-3.5 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                    <p className="mt-0.5 truncate text-[12px] text-muted">{search.query}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-faint">
                      <span>Saved {formatRelative(search.createdAt)}</span>
                      {search.alertsEnabled && (
                        <span className="inline-flex items-center gap-1 text-accent-text">
                          <Bell className="size-3" aria-hidden />
                          Alerts on
                        </span>
                      )}
                    </p>
                  </div>

                  <SavedSearchControls id={search.id} alertsEnabled={search.alertsEnabled} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* History --------------------------------------------------------- */}
        <SectionCard
          title="Recent searches"
          description={history.length > 0 ? 'Click any row to run it again' : undefined}
          padded={history.length === 0}
        >
          {history.length === 0 ? (
            <StateBlock
              title="No searches yet"
              description="Describe a requirement to the assistant, or search the catalogue by keyword. Either way it is recorded here."
              primaryAction={{ label: 'Ask the assistant', href: '/assistant' }}
              secondaryAction={{ label: 'Browse products', href: '/products' }}
              compact
            />
          ) : (
            <ul className="divide-y divide-border">
              {history.map((event) => (
                <li key={event.id}>
                  <Link
                    href={
                      event.mode === 'ai'
                        ? `/assistant?q=${encodeURIComponent(event.query)}`
                        : `/products?q=${encodeURIComponent(event.query)}`
                    }
                    className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className={
                        event.mode === 'ai'
                          ? 'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-accent-line bg-accent-soft text-accent-text'
                          : 'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-muted'
                      }
                      aria-hidden
                    >
                      {event.mode === 'ai' ? (
                        <Sparkles className="size-3.5" />
                      ) : (
                        <Search className="size-3.5" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-snug text-text">{event.query}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                        <span>{formatRelative(event.createdAt)}</span>
                        <span className="font-mono tnum">
                          {pluralize(event.resultCount, 'result')}
                        </span>
                        {event.clickedProductIds.length > 0 && (
                          <span className="font-mono tnum">
                            {event.clickedProductIds.length} opened
                          </span>
                        )}
                        <span className="font-mono tnum">{event.tookMs} ms</span>
                      </p>
                    </div>

                    {event.convertedToRfq && (
                      <Badge tone="success" size="sm" className="shrink-0">
                        Quoted
                      </Badge>
                    )}
                    {event.resultCount === 0 && (
                      <Badge tone="warning" size="sm" className="shrink-0">
                        No results
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  )
}
