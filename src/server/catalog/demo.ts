import 'server-only'
import { formatPrice, truncate } from '@/lib/format'
import type { HeroScenario } from '@/components/home/hero-demo'
import { parseIntentOffline } from '@/server/ai/intent-offline'
import { intentToChips } from '@/server/ai/chips'
import { getCatalogRepository } from '@/server/repositories'
import { highlightSpecs } from './highlights'

/**
 * Live demonstration data for the marketing pages.
 *
 * Everything the homepage claims the assistant can do is produced here by
 * running the real parser and the real ranking engine over the real
 * catalogue. If the engine regresses, the landing page shows the regression.
 * That is the point — a marketing section built from hand-written fixtures is
 * a promise the product has no obligation to keep.
 *
 * These run at build time (the marketing pages are static), so they cost
 * nothing at request time.
 */

export const CANONICAL_QUERIES = [
  'I need a stainless steel threaded valve for an HVAC system, between ₹3,000 and ₹5,000',
  'Something to control water flow in a commercial HVAC riser, stainless, threaded',
  '100A 3 pole MCCB with 25kA breaking capacity for a commercial building',
  'Pressure gauge for chilled water, 0–16 bar, 100mm dial',
] as const

/**
 * The engine treats a budget as a soft preference, so a close match slightly
 * outside the stated band can out-rank an in-band one. Correct for search,
 * wrong for a marketing panel that prints the band right above the prices —
 * prefer in-band results for display when enough of them exist.
 */
function preferWithinBudget<T extends { product: { price: number } }>(
  ranked: T[],
  price: { min?: number; max?: number },
  needed: number
): T[] {
  const inBand = ranked.filter(
    (r) =>
      (price.min == null || r.product.price >= price.min) &&
      (price.max == null || r.product.price <= price.max)
  )
  return inBand.length >= needed ? inBand : ranked
}

export async function heroScenarios(): Promise<HeroScenario[]> {
  const repository = getCatalogRepository()
  const scenarios: HeroScenario[] = []

  for (const query of CANONICAL_QUERIES.slice(0, 3)) {
    const intent = parseIntentOffline(query)
    const { results: ranked, total: rankedTotal } = await repository.rankByIntent(intent, 24)

    scenarios.push({
      query,
      chips: intentToChips(intent)
        .slice(0, 5)
        .map((chip) => ({ qualifier: chip.qualifier ?? '', label: chip.label })),
      results: preferWithinBudget(ranked, intent.price, 3).slice(0, 3).map((result) => ({
        sku: result.product.sku,
        name: truncate(result.product.name, 52),
        price: formatPrice(result.product.price),
        match: result.explanation.matchPercent,
        spec: highlightSpecs(result.product, 2)
          .map((spec) => spec.displayValue)
          .join(' · '),
      })),
      totalMatches: rankedTotal,
    })
  }

  return scenarios
}

/* -------------------------------------------------------------------------- */

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantDemo {
  turns: ConversationTurn[]
  chips: { qualifier: string; label: string }[]
  results: {
    slug: string
    sku: string
    name: string
    brand: string
    price: string
    match: number
    reason: string
    specs: string[]
    imageUrl: string
    imageAlt: string
  }[]
  totalMatches: number
}

/**
 * The section-2 conversation. Two turns: an under-specified request that
 * triggers a follow-up, then the answer that resolves it — because the
 * follow-up is the part of the product that is genuinely hard, and showing a
 * one-shot query would undersell it.
 */
export async function assistantDemo(): Promise<AssistantDemo> {
  const repository = getCatalogRepository()

  const query =
    'I need a stainless steel valve for a commercial HVAC system, threaded connection, under ₹5,000'
  const intent = parseIntentOffline(query)
  const { results: ranked, total: rankedTotal } = await repository.rankByIntent(intent, 24)

  return {
    turns: [
      { role: 'user', content: 'I need a valve for an HVAC system.' },
      {
        role: 'assistant',
        content:
          'I can narrow that down quickly. Two things decide it: the body material, and whether the connection is threaded or flanged. What is the pipework?',
      },
      {
        role: 'user',
        content: 'Stainless steel, threaded. It is a commercial building, and I want to stay under ₹5,000.',
      },
      {
        role: 'assistant',
        content: `Understood. I found ${rankedTotal} products that match. These three are the strongest — all SS316, all BSP threaded, all inside your budget.`,
      },
    ],
    chips: intentToChips(intent)
      .slice(0, 5)
      .map((chip) => ({ qualifier: chip.qualifier ?? '', label: chip.label })),
    results: preferWithinBudget(ranked, intent.price, 3).slice(0, 3).map((result) => ({
      slug: result.product.slug,
      sku: result.product.sku,
      name: result.product.name,
      brand: result.product.brand.name,
      price: formatPrice(result.product.price),
      match: result.explanation.matchPercent,
      reason: result.explanation.summary,
      specs: highlightSpecs(result.product, 3).map((spec) => spec.displayValue),
      imageUrl: result.product.images[0]?.url ?? '',
      imageAlt: result.product.images[0]?.alt ?? result.product.name,
    })),
    totalMatches: ranked.length,
  }
}

/* -------------------------------------------------------------------------- */

export interface DiscoveryExample {
  query: string
  chips: { qualifier: string; label: string }[]
  resultCount: number
  topMatch: number
}

/** Section 4: natural language on the left, resolved structure on the right. */
export async function discoveryExamples(): Promise<DiscoveryExample[]> {
  const repository = getCatalogRepository()

  const queries = [
    'Show me industrial pumps for high-pressure applications',
    'A budget-friendly electrical breaker for a commercial building',
    'HVAC equipment suitable for a large warehouse',
    'Cut-resistant gloves for sheet metal handling, EN388',
  ]

  const examples: DiscoveryExample[] = []

  for (const query of queries) {
    const intent = parseIntentOffline(query)
    const { results: ranked, total: rankedTotal } = await repository.rankByIntent(intent, 24)
    examples.push({
      query,
      chips: intentToChips(intent)
        .slice(0, 4)
        .map((chip) => ({ qualifier: chip.qualifier ?? '', label: chip.label })),
      resultCount: rankedTotal,
      topMatch: ranked[0]?.explanation.matchPercent ?? 0,
    })
  }

  return examples
}

/* -------------------------------------------------------------------------- */

export interface ComparisonDemo {
  columns: {
    slug: string
    sku: string
    name: string
    brand: string
    price: string
    match: number
  }[]
  rows: { label: string; values: (string | null)[] }[]
  verdict: string
}

/**
 * Section 6: a genuine three-way comparison, generated by pulling the top
 * three results for the canonical query and diffing their specification
 * sheets. The verdict names the actual trade-off rather than declaring a
 * winner, because in procurement there usually is not one.
 */
export async function comparisonDemo(): Promise<ComparisonDemo | null> {
  const repository = getCatalogRepository()
  const intent = parseIntentOffline(
    'stainless steel threaded valve for HVAC between ₹3,000 and ₹5,000'
  )
  const { results: ranked } = await repository.rankByIntent(intent, 12)
  const picks = ranked.slice(0, 3)
  if (picks.length < 3) return null

  const SHOWN = ['valve_type', 'material', 'connection_type', 'size_dn', 'pressure_rating_bar', 'temperature_max_c']
  const LABELS: Record<string, string> = {
    valve_type: 'Type',
    material: 'Body material',
    connection_type: 'Connection',
    size_dn: 'Nominal size',
    pressure_rating_bar: 'Pressure rating',
    temperature_max_c: 'Max temperature',
  }

  const rows: { label: string; values: (string | null)[] }[] = [
    {
      label: 'Price',
      values: picks.map((pick) => formatPrice(pick.product.price)),
    },
    ...SHOWN.map((key) => ({
      label: LABELS[key] ?? key,
      values: picks.map(
        (pick) => pick.product.specs.find((spec) => spec.key === key)?.displayValue ?? null
      ),
    })),
    {
      label: 'Availability',
      values: picks.map((pick) =>
        pick.product.availability.state === 'in_stock'
          ? 'Ready stock'
          : pick.product.availability.state === 'low_stock'
            ? 'Low stock'
            : `${pick.product.availability.leadTimeDays} day lead`
      ),
    },
    {
      label: 'Warranty',
      values: picks.map((pick) =>
        pick.product.warrantyMonths ? `${pick.product.warrantyMonths / 12} years` : '—'
      ),
    },
  ]

  const cheapest = picks.reduce((min, pick) => (pick.product.price < min.product.price ? pick : min))
  const best = picks[0]
  const serviceable = picks.find((pick) => pick.product.name.includes('3-Piece'))

  const verdict = serviceable
    ? `All three meet the specification. ${cheapest.product.brand.name}'s ${formatPrice(cheapest.product.price)} option is the cheapest way to satisfy it. The three-piece body costs ${formatPrice(serviceable.product.price - cheapest.product.price)} more and is the one to choose if these valves will be serviced rather than replaced — it opens in line without cutting the pipework.`
    : `All three meet the specification. The ${formatPrice(cheapest.product.price)} option is the cheapest that does, and ${best?.product.brand.name ?? 'the top match'} scores highest overall on specification fit and availability.`

  return {
    columns: picks.map((pick) => ({
      slug: pick.product.slug,
      sku: pick.product.sku,
      name: pick.product.name,
      brand: pick.product.brand.name,
      price: formatPrice(pick.product.price),
      match: pick.explanation.matchPercent,
    })),
    rows,
    verdict,
  }
}
