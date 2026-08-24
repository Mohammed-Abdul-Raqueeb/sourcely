import 'server-only'
import type { ProductView } from '@/lib/domain/catalog'
import type {
  FollowUpQuestion,
  IntentSource,
  RankedProduct,
  SearchIntent,
} from '@/lib/domain/search'
import { formatPrice, pluralize } from '@/lib/format'
import { applicationLabel } from '@/server/catalog/spec-registry'
import {
  conversationalReply,
  isStructureless,
  matchConversational,
} from './conversation'
import { parseIntentOffline } from './intent-offline'

/**
 * The AI provider seam.
 *
 * Exactly three operations cross this boundary:
 *
 *   interpret     language  →  a conversational reply OR a structured SearchIntent
 *   parseIntent   language  →  structured SearchIntent (refinement re-parse)
 *   narrate       computed facts  →  natural prose
 *
 * Nothing else. The provider never filters, never ranks, never prices, and
 * never decides what matches — those are `src/server/catalog/`, and every
 * number a buyer sees comes from there. See ARCHITECTURE.md §7.1.
 *
 * `interpret` exists so a greeting gets a greeting back instead of twelve
 * arbitrary products. Its contract is deliberately conservative: a message is
 * conversation only when it reads as small talk AND the parser found no
 * product structure in it — anything else is a search. See conversation.ts.
 *
 * The offline implementation is a real implementation, not a stub: the whole
 * product works with no API key. Configuring Claude upgrades these steps
 * in place and changes nothing downstream.
 */

/** What a buyer's message turned out to be: small talk, or a requirement. */
export type TurnInterpretation =
  | { kind: 'chat'; reply: string }
  | { kind: 'search'; intent: SearchIntent }

export interface NarrateInput {
  intent: SearchIntent
  results: RankedProduct[]
  totalMatches: number
  followUp: FollowUpQuestion | null
  /** Prior turns, oldest first, for conversational continuity. */
  history: { role: 'user' | 'assistant'; content: string }[]
}

export interface AiProvider {
  readonly name: IntentSource
  /** False when credentials are missing — the UI says so rather than pretending. */
  readonly configured: boolean

  /** Classifies a fresh `ask` and either replies in kind or parses an intent. */
  interpret(query: string, history?: NarrateInput['history']): Promise<TurnInterpretation>
  parseIntent(query: string, history?: NarrateInput['history']): Promise<SearchIntent>
  narrate(input: NarrateInput): Promise<string>
  compare(products: ProductView[]): Promise<string>
}

/* -------------------------------------------------------------------------- */
/* Offline                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Templated prose over the computed result.
 *
 * Deliberately plain. It states what was found and why, and it never claims a
 * fluency it does not have — an offline assistant that writes like a
 * salesperson is more unsettling than one that writes like a parts counter.
 */
export class OfflineProvider implements AiProvider {
  readonly name = 'offline' as const
  readonly configured = true

  async interpret(query: string, _history?: NarrateInput['history']): Promise<TurnInterpretation> {
    const intent = parseIntentOffline(query)

    // Chat only when the message reads as small talk AND parsing found no
    // product structure. "hi, I need a DN50 valve" has structure — it searches.
    const kind = matchConversational(query)
    if (kind && isStructureless(intent)) {
      return { kind: 'chat', reply: conversationalReply(kind, query) }
    }

    return { kind: 'search', intent }
  }

  async parseIntent(query: string): Promise<SearchIntent> {
    return parseIntentOffline(query)
  }

  async narrate({ intent, results, totalMatches, followUp }: NarrateInput): Promise<string> {
    if (results.length === 0) {
      return unmatchedMessage(intent)
    }

    const parts: string[] = []
    const top = results[0]

    // `totalMatches` is every product above the relevance floor; `results` is
    // the page. Saying "found 12" when 19 matched is the kind of almost-true
    // number this product is built to avoid.
    if (totalMatches === 1) {
      parts.push('One product matches that.')
    } else if (totalMatches > results.length) {
      parts.push(
        `Found ${pluralize(totalMatches, 'product')} that match — here are the ${results.length} strongest.`
      )
    } else {
      parts.push(`Found ${pluralize(totalMatches, 'product')} that match.`)
    }

    if (top) {
      const criteria = top.explanation.criteria.filter((c) => c.status === 'match')
      if (criteria.length > 0) {
        const named = criteria
          .slice(0, 3)
          .map((criterion) => criterion.label.toLowerCase())
          .join(', ')
        parts.push(
          `The closest is the ${top.product.name} at ${formatPrice(top.product.price)} — it satisfies ${named}.`
        )
      } else {
        parts.push(
          `The closest is the ${top.product.name} at ${formatPrice(top.product.price)}.`
        )
      }
    }

    // Name the trade-off when the set genuinely spans one.
    const cheapest = results.reduce((min, r) => (r.product.price < min.product.price ? r : min), results[0]!)
    if (cheapest.product.id !== top?.product.id) {
      parts.push(
        `${cheapest.product.name} is the cheapest option that still fits, at ${formatPrice(cheapest.product.price)}.`
      )
    }

    const partial = results.filter((result) =>
      result.explanation.criteria.some((criterion) => criterion.status === 'partial')
    )
    if (partial.length > 0 && partial.length < results.length) {
      parts.push(
        `${pluralize(partial.length, 'result')} are close rather than exact — the differences are listed on each card.`
      )
    }

    if (followUp) parts.push(followUp.question)

    return parts.join(' ')
  }

  async compare(products: ProductView[]): Promise<string> {
    return offlineComparison(products)
  }
}

/* -------------------------------------------------------------------------- */
/* Shared prose helpers                                                       */
/* -------------------------------------------------------------------------- */

function unmatchedMessage(intent: SearchIntent): string {
  if (intent.categoryKeys.length === 0) {
    return (
      'I could not identify a product type from that. Tell me what the item has to ' +
      'do and roughly where it will be installed — that is usually enough to place it.'
    )
  }

  const blockers: string[] = []
  if (intent.price.max != null) blockers.push(`the ${formatPrice(intent.price.max)} ceiling`)
  if (intent.requiresInStock) blockers.push('the ready-stock requirement')
  if (intent.excludedTerms.length > 0) blockers.push(`ruling out ${intent.excludedTerms.join(' and ')}`)

  return blockers.length > 0
    ? `Nothing in the catalogue satisfies all of that. ${blockers[0]?.charAt(0).toUpperCase()}${blockers[0]?.slice(1)} is the binding constraint — relax it and I will show you the nearest options.`
    : 'Nothing matches that combination. Try removing one requirement and I will show you what is closest.'
}

/**
 * Comparison prose built from the actual specification differences.
 *
 * States the trade-off rather than declaring a winner, because in procurement
 * there usually is not one — the cheapest that meets the spec and the one that
 * survives being serviced are different answers to different questions.
 */
function offlineComparison(products: ProductView[]): string {
  if (products.length < 2) return 'Add a second product and I will line the specifications up.'

  const sorted = [...products].sort((a, b) => a.price - b.price)
  const cheapest = sorted[0]!
  const dearest = sorted[sorted.length - 1]!
  const spread = dearest.price - cheapest.price

  const parts: string[] = []

  if (spread === 0) {
    parts.push(`All ${products.length} are the same price at ${formatPrice(cheapest.price)}.`)
  } else {
    const percent = Math.round((spread / cheapest.price) * 100)
    parts.push(
      `${formatPrice(spread)} separates these — ${percent}% between ${cheapest.brand.name} at ${formatPrice(cheapest.price)} and ${dearest.brand.name} at ${formatPrice(dearest.price)}.`
    )
  }

  // Which specs actually differ? Identical rows are not worth a sentence.
  const comparableKeys = new Set(products.flatMap((p) => p.specs.map((s) => s.key)))
  const differing: string[] = []

  for (const key of comparableKeys) {
    const values = products.map(
      (product) => product.specs.find((spec) => spec.key === key)?.displayValue ?? '—'
    )
    if (new Set(values).size > 1) differing.push(key)
  }

  if (differing.length === 0) {
    parts.push(
      'On every published specification they are equivalent, so this comes down to price, lead time and who you would rather buy from.'
    )
  } else {
    const readable = differing
      .slice(0, 3)
      .map((key) => key.replace(/_/g, ' '))
      .join(', ')
    parts.push(`They differ on ${readable}.`)
  }

  const inStock = products.filter((product) => product.availability.state === 'in_stock')
  if (inStock.length > 0 && inStock.length < products.length) {
    // Two products from the same manufacturer would otherwise read as
    // "Vantek and Vantek are available from stock". Name the brand once, and
    // fall back to product names when the brand cannot tell them apart.
    const brands = [...new Set(inStock.map((product) => product.brand.name))]
    const subject =
      brands.length === inStock.length
        ? brands.join(' and ')
        : inStock.map((product) => product.name).join(' and ')

    parts.push(
      `${subject} ${inStock.length === 1 ? 'is' : 'are'} available from stock; the rest carry a lead time.`
    )
  }

  const bestWarranty = products.reduce((best, product) =>
    (product.warrantyMonths ?? 0) > (best.warrantyMonths ?? 0) ? product : best
  )
  if ((bestWarranty.warrantyMonths ?? 0) > (cheapest.warrantyMonths ?? 0)) {
    parts.push(
      `${bestWarranty.brand.name} carries the longest warranty at ${Math.round((bestWarranty.warrantyMonths ?? 0) / 12)} years.`
    )
  }

  const applications = products[0]?.applications ?? []
  const shared = applications.filter((application) =>
    products.every((product) => product.applications.includes(application))
  )
  if (shared.length > 0) {
    parts.push(`All of them are documented for ${shared.slice(0, 2).map(applicationLabel).join(' and ')}.`)
  }

  return parts.join(' ')
}

export { offlineComparison, unmatchedMessage }

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

let cached: AiProvider | null = null

export function resolveProviderName(): IntentSource {
  return process.env.AI_PROVIDER?.toLowerCase() === 'claude' ? 'claude' : 'offline'
}

/**
 * Resolves the configured provider.
 *
 * `AI_PROVIDER=claude` with no API key falls back to offline with a warning
 * rather than throwing. A search box that returns an error because a
 * credential is missing is worse than one that returns slightly plainer prose.
 */
export function getAiProvider(): AiProvider {
  if (cached) return cached

  if (resolveProviderName() === 'claude') {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(
        '[ai] AI_PROVIDER=claude but ANTHROPIC_API_KEY is unset — using the offline engine.'
      )
      cached = new OfflineProvider()
      return cached
    }

    // Loaded lazily so the SDK never enters a bundle that will not use it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClaudeProvider } = require('./claude-provider') as typeof import('./claude-provider')
    cached = new ClaudeProvider()
    return cached
  }

  cached = new OfflineProvider()
  return cached
}
