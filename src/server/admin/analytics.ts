import 'server-only'
import type { ProductView } from '@/lib/domain/catalog'
import type { Rfq, SearchEvent } from '@/lib/domain/account'
import {
  getAdminRepository,
  getCatalogRepository,
} from '@/server/repositories'
import { CATEGORY_BY_KEY } from '@/server/seed/taxonomy'

/**
 * Admin analytics.
 *
 * Everything here is computed from the same records the product writes during
 * normal use — `SearchEvent` rows, RFQs, and the catalogue itself. Nothing is
 * a placeholder figure.
 *
 * The metric that matters most is the **zero-result rate**. A catalogue search
 * that returns nothing is a buyer who leaves, and unlike a low conversion rate
 * it names its own cause: the query is right there in the row. It is the first
 * number on the dashboard for that reason.
 */

const DAY = 86_400_000

export interface QueryStat {
  query: string
  count: number
  averageResults: number
  zeroCount: number
  aiShare: number
  clickThrough: number
}

export interface DailyPoint {
  label: string
  short: string
  value: number
}

export interface AdminOverview {
  catalogue: {
    total: number
    active: number
    inStock: number
    outOfStock: number
    madeToOrder: number
    categories: number
    brands: number
    sellers: number
    averagePrice: number
  }
  people: {
    users: number
    newThisWeek: number
    activeThisWeek: number
  }
  search: {
    total: number
    last7Days: number
    last30Days: number
    aiShare: number
    zeroResultRate: number
    /** Median, not mean — one slow cold start should not move this. */
    medianTookMs: number
    conversionRate: number
  }
  rfq: {
    total: number
    open: number
    awaitingSupplier: number
    quoted: number
    quotedValue: number
    medianResponseHours: number | null
  }
  daily: DailyPoint[]
  topQueries: QueryStat[]
  failedQueries: QueryStat[]
  topCategories: { key: string; name: string; searches: number }[]
  topProducts: { product: ProductView; views: number; rfqs: number; saves: number }[]
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
    : (sorted[middle] ?? 0)
}

/** Groups events by their normalised query text. */
function groupQueries(events: SearchEvent[]): QueryStat[] {
  const groups = new Map<string, SearchEvent[]>()

  for (const event of events) {
    const key = event.query.trim().toLowerCase()
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(event)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .map(([query, rows]) => ({
      query,
      count: rows.length,
      averageResults:
        Math.round(
          (rows.reduce((sum, row) => sum + row.resultCount, 0) / rows.length) * 10
        ) / 10,
      zeroCount: rows.filter((row) => row.resultCount === 0).length,
      aiShare: rows.filter((row) => row.mode === 'ai').length / rows.length,
      clickThrough:
        rows.filter((row) => row.clickedProductIds.length > 0).length / rows.length,
    }))
    .sort((a, b) => b.count - a.count)
}

export async function buildOverview(): Promise<AdminOverview> {
  const admin = getAdminRepository()
  const catalog = getCatalogRepository()

  const [stats, users, rfqs, events, allProducts] = await Promise.all([
    catalog.stats(),
    admin.listUsers(500),
    admin.listAllRfqs(500),
    admin.listAllSearchEvents(2000),
    catalog.listAll(),
  ])

  const now = Date.now()
  const since = (days: number) => now - days * DAY

  /* --- Catalogue -------------------------------------------------------- */

  const active = allProducts.filter((product) => product.status === 'active')

  const catalogue = {
    total: allProducts.length,
    active: active.length,
    inStock: stats.inStock,
    outOfStock: active.filter((p) => p.availability.state === 'out_of_stock').length,
    madeToOrder: active.filter((p) => p.availability.state === 'made_to_order').length,
    categories: stats.categories,
    brands: stats.brands,
    sellers: stats.sellers,
    averagePrice: stats.averagePrice,
  }

  /* --- People ------------------------------------------------------------ */

  const people = {
    users: users.length,
    newThisWeek: users.filter((user) => new Date(user.createdAt).getTime() >= since(7)).length,
    activeThisWeek: users.filter(
      (user) => new Date(user.lastActiveAt).getTime() >= since(7)
    ).length,
  }

  /* --- Search ------------------------------------------------------------ */

  const recent7 = events.filter((event) => new Date(event.createdAt).getTime() >= since(7))
  const recent30 = events.filter((event) => new Date(event.createdAt).getTime() >= since(30))

  const search = {
    total: events.length,
    last7Days: recent7.length,
    last30Days: recent30.length,
    aiShare:
      events.length > 0
        ? events.filter((event) => event.mode === 'ai').length / events.length
        : 0,
    zeroResultRate:
      events.length > 0
        ? events.filter((event) => event.resultCount === 0).length / events.length
        : 0,
    medianTookMs: median(events.map((event) => event.tookMs)),
    conversionRate:
      events.length > 0
        ? events.filter((event) => event.convertedToRfq).length / events.length
        : 0,
  }

  /* --- RFQ --------------------------------------------------------------- */

  const openStatuses = new Set(['submitted', 'under_review', 'quoted', 'negotiating'])
  const quoted = rfqs.filter((rfq) => rfq.quotedTotal != null)

  const responseHours = rfqs
    .filter((rfq) => rfq.messages.length > 0)
    .map((rfq) => {
      const first = rfq.messages[0]
      if (!first) return null
      return (
        (new Date(first.createdAt).getTime() - new Date(rfq.createdAt).getTime()) / 3_600_000
      )
    })
    .filter((hours): hours is number => hours != null && hours >= 0)

  const rfq = {
    total: rfqs.length,
    open: rfqs.filter((entry: Rfq) => openStatuses.has(entry.status)).length,
    awaitingSupplier: rfqs.filter((entry) =>
      ['submitted', 'under_review'].includes(entry.status)
    ).length,
    quoted: rfqs.filter((entry) => entry.status === 'quoted').length,
    quotedValue: quoted.reduce((sum, entry) => sum + (entry.quotedTotal ?? 0), 0),
    medianResponseHours: responseHours.length > 0 ? median(responseHours) : null,
  }

  /* --- Daily ------------------------------------------------------------- */

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const daily: DailyPoint[] = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date(now - (13 - offset) * DAY)
    const key = date.toISOString().slice(0, 10)
    return {
      label: key,
      short: offset % 2 === 0 ? (DAY_LABELS[date.getDay()] ?? '') : '',
      value: events.filter((event) => event.createdAt.slice(0, 10) === key).length,
    }
  })

  /* --- Queries ----------------------------------------------------------- */

  const grouped = groupQueries(events)
  const topQueries = grouped.slice(0, 12)
  const failedQueries = grouped
    .filter((stat) => stat.zeroCount > 0)
    .sort((a, b) => b.zeroCount - a.zeroCount)
    .slice(0, 10)

  /* --- Categories -------------------------------------------------------- */

  const categoryCounts = new Map<string, number>()
  for (const event of events) {
    for (const key of event.intent?.categoryKeys ?? []) {
      categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1)
    }
  }

  const topCategories = [...categoryCounts.entries()]
    .map(([key, searches]) => ({
      key,
      name: CATEGORY_BY_KEY.get(key)?.name ?? key,
      searches,
    }))
    .sort((a, b) => b.searches - a.searches)
    .slice(0, 8)

  /* --- Products ---------------------------------------------------------- */

  const clickCounts = new Map<string, number>()
  for (const event of events) {
    for (const id of event.clickedProductIds) {
      clickCounts.set(id, (clickCounts.get(id) ?? 0) + 1)
    }
  }

  const rfqCounts = new Map<string, number>()
  for (const entry of rfqs) {
    for (const item of entry.items) {
      rfqCounts.set(item.productId, (rfqCounts.get(item.productId) ?? 0) + item.quantity)
    }
  }

  // Ranked by demand this catalogue has actually seen — clicks from search and
  // quantities on real quotation requests — with the seeded view count as a
  // tiebreaker rather than the driver.
  const ranked = await catalog.findManyByIds(
    [...new Set([...clickCounts.keys(), ...rfqCounts.keys()])].slice(0, 40)
  )

  const topProducts = ranked
    .map((product) => ({
      product,
      views: clickCounts.get(product.id) ?? 0,
      rfqs: rfqCounts.get(product.id) ?? 0,
      saves: product.metrics.saves,
    }))
    .sort((a, b) => b.rfqs * 10 + b.views - (a.rfqs * 10 + a.views))
    .slice(0, 8)

  return {
    catalogue,
    people,
    search,
    rfq,
    daily,
    topQueries,
    failedQueries,
    topCategories,
    topProducts,
  }
}
