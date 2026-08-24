import 'server-only'
import { cache } from 'react'
import type { PlatformStat } from '@/lib/site'
import { getAdminRepository, getCatalogRepository } from '@/server/repositories'

/**
 * The four figures shown on the homepage and the sign-in split screen.
 *
 * Every one is derived from the database at request time. The previous version
 * of this file was a hand-written array — "12,400+ verified SKUs", "96% search
 * success rate" — and the problem with those is not that they were optimistic
 * but that nothing in the system could produce them. A trust marker that the
 * product cannot reproduce on demand is a claim, and a claim on a page that
 * exists to demonstrate rigour undermines the thing it decorates.
 *
 * Where the data is too thin to support a figure honestly, the figure is
 * dropped rather than padded. A homepage with three statistics is fine; a
 * homepage with four statistics one of which is invented is not.
 */

/** Indian digit grouping — 12,40,000 rather than 1,240,000. */
function formatCount(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

/**
 * Rounds down to a round number and adds a plus.
 *
 * "1,240+" is a claim that survives the next few writes; the exact count is
 * stale the moment a product is added, and correcting it on every page view
 * makes the number look unstable.
 */
function approximate(value: number): string {
  if (value < 10) return String(value)
  const magnitude = value < 100 ? 10 : value < 1_000 ? 50 : 100
  return `${formatCount(Math.floor(value / magnitude) * magnitude)}+`
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${hours.toFixed(1)} hrs`
  return `${Math.round(hours / 24)} days`
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/**
 * `cache` deduplicates within a single render pass — the homepage and the
 * layout both ask for these, and they should not be two round trips.
 */
export const platformStats = cache(async (): Promise<PlatformStat[]> => {
  const catalog = getCatalogRepository()
  const admin = getAdminRepository()

  const [stats, sellers, searchEvents, rfqs] = await Promise.all([
    catalog.stats(),
    catalog.sellers(),
    admin.listAllSearchEvents(2_000),
    admin.listAllRfqs(500),
  ])

  const result: PlatformStat[] = [
    { value: approximate(stats.products), label: 'Catalogued SKUs' },
    { value: approximate(sellers.length), label: 'Verified suppliers' },
  ]

  /* --- Search success ---------------------------------------------------- */
  // The share of searches that returned at least one product. Below a
  // reasonable sample this says more about the sample than the engine, so it
  // is omitted rather than computed from a handful of events.
  if (searchEvents.length >= 25) {
    const answered = searchEvents.filter((event) => event.resultCount > 0).length
    const rate = Math.round((answered / searchEvents.length) * 100)
    result.push({ value: `${rate}%`, label: 'Searches with a match' })
  }

  /* --- Quote turnaround --------------------------------------------------- */
  // Median rather than mean: one quotation left open over a weekend would drag
  // an average far past anything a buyer would actually experience.
  const turnarounds = rfqs
    .filter((rfq) => rfq.status === 'quoted' || rfq.status === 'accepted')
    .map((rfq) => (Date.parse(rfq.updatedAt) - Date.parse(rfq.createdAt)) / 3_600_000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0)

  const typical = turnarounds.length >= 5 ? median(turnarounds) : null
  if (typical != null) {
    result.push({ value: formatHours(typical), label: 'Median quote response' })
  }

  /* --- Availability ------------------------------------------------------- */
  // Only used to fill the fourth slot when quote turnaround has no data yet,
  // so the grid stays balanced without anything being invented.
  if (result.length < 4 && stats.products > 0) {
    const inStock = Math.round((stats.inStock / stats.products) * 100)
    result.push({ value: `${inStock}%`, label: 'Available from stock' })
  }

  return result
})
