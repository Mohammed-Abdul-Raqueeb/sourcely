/**
 * Search, intent and ranking contracts.
 *
 * The important boundary in this file: `SearchIntent` is the *only* thing an
 * LLM is allowed to produce. Everything downstream of it — filtering, scoring,
 * `matchPercent`, the criteria table — is computed by code in
 * `src/server/catalog/`. See ARCHITECTURE.md section 3.1.
 */

import type { AvailabilityState, ProductView } from './catalog'

/* -------------------------------------------------------------------------- */
/* Query                                                                      */
/* -------------------------------------------------------------------------- */

export interface PriceBand {
  min?: number
  max?: number
}

/** One constraint on one spec key. Enum and numeric forms are both valid. */
export interface SpecConstraint {
  key: string
  /** Canonical enum values, OR-ed together. */
  values?: string[]
  min?: number
  max?: number
  unit?: string
  /**
   * A soft constraint contributes to the score but never removes a product.
   * A hard constraint is applied as a filter. Price maximum is always hard;
   * material preference is usually soft.
   */
  hard?: boolean
}

export const SORT_KEYS = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
  'rating',
  'popular',
] as const

export type SortKey = (typeof SORT_KEYS)[number]

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Best match',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest first',
  rating: 'Highest rated',
  popular: 'Most enquired',
}

export interface CatalogQuery {
  /** Free text. Lexical retrieval only — no intent parsing at this layer. */
  text?: string
  categoryKeys?: string[]
  brandKeys?: string[]
  sellerKeys?: string[]
  specs?: SpecConstraint[]
  price?: PriceBand
  availability?: AvailabilityState[]
  applications?: string[]
  minRating?: number
  sort?: SortKey
  /** Opaque cursor. Never an offset — see ARCHITECTURE.md 2.4. */
  cursor?: string
  limit?: number
}

/* -------------------------------------------------------------------------- */
/* Facets                                                                     */
/* -------------------------------------------------------------------------- */

export interface FacetBucket {
  value: string
  label: string
  count: number
  selected: boolean
}

export interface FacetRange {
  min: number
  max: number
  selectedMin: number | null
  selectedMax: number | null
  unit?: string
}

export type FacetKind = 'enum' | 'range'

export interface Facet {
  key: string
  label: string
  kind: FacetKind
  /** Which UI group the facet renders under in the sidebar. */
  group: string
  buckets?: FacetBucket[]
  range?: FacetRange
  /** Facets beyond this count collapse behind a "show all" control. */
  collapseAfter?: number
}

/* -------------------------------------------------------------------------- */
/* Results                                                                    */
/* -------------------------------------------------------------------------- */

export interface Page<T> {
  items: T[]
  /** Total matching the filters, not the page size. */
  total: number
  nextCursor: string | null
  facets: Facet[]
  /** Wall-clock time spent in the search engine, surfaced in the UI. */
  tookMs: number
}

/* -------------------------------------------------------------------------- */
/* Intent — the LLM output contract                                           */
/* -------------------------------------------------------------------------- */

export type IntentSource = 'offline' | 'claude'

/**
 * The structured form of a natural-language request. Rendered in the UI as
 * editable chips, which is what makes an AI search correctable rather than
 * a black box.
 */
export interface SearchIntent {
  rawQuery: string
  normalizedQuery: string

  categoryKeys: string[]
  brandKeys: string[]
  specs: SpecConstraint[]
  price: PriceBand
  applications: string[]
  industries: string[]

  quantity: number | null
  /** Buyer explicitly asked for ready stock. */
  requiresInStock: boolean

  /** Residual terms used for lexical retrieval. */
  keywords: string[]
  /** Raw terms the buyer ruled out, e.g. "brass". Shown as struck-through chips. */
  excludedTerms: string[]
  /**
   * Exclusions resolved against the spec registry, applied as hard filters.
   *
   * A stated negative is the strongest signal a buyer gives. Showing someone
   * the exact thing they said they did not want reads as not having listened,
   * so these remove products rather than merely penalising them.
   */
  excludedSpecs: SpecConstraint[]

  /** 0..1 — how much of the query the parser accounted for. */
  confidence: number
  /**
   * Critical spec keys for the resolved category that the query did not
   * supply. Drives the single follow-up question. See ARCHITECTURE.md 3.3.
   */
  missingCriticalFields: string[]

  source: IntentSource
}

/** A chip rendered from an intent, and the handle used to remove it. */
export interface IntentChip {
  /** Stable id: `spec:material:stainless_steel`, `price:max`, `category:valves`. */
  id: string
  kind: 'category' | 'brand' | 'spec' | 'price' | 'application' | 'quantity' | 'availability' | 'keyword'
  label: string
  /** Rendered smaller, before the label — e.g. `Material`. */
  qualifier?: string
  removable: boolean
  /** Below this, the chip renders with a dashed border as "inferred". */
  confidence: number
}

/* -------------------------------------------------------------------------- */
/* Scoring & explanation                                                      */
/* -------------------------------------------------------------------------- */

export const SCORE_COMPONENT_KEYS = [
  'specMatch',
  'semantic',
  'lexical',
  'priceFit',
  'applicationFit',
  'availability',
  'popularity',
  'sellerTrust',
] as const

export type ScoreComponentKey = (typeof SCORE_COMPONENT_KEYS)[number]

export interface ScoreComponent {
  key: ScoreComponentKey
  label: string
  weight: number
  /** 0..1 before weighting. */
  raw: number
  /** weight * raw. */
  weighted: number
}

export type CriterionStatus = 'match' | 'partial' | 'miss' | 'unknown'

/**
 * One row of the "why this matches" table. This is the honest core of the
 * feature: a miss is shown as a miss.
 */
export interface CriterionOutcome {
  key: string
  label: string
  /** What the buyer asked for, in their terms. */
  requested: string
  /** What the product actually is. null when the product has no such spec. */
  actual: string | null
  status: CriterionStatus
  note?: string
}

export interface MatchExplanation {
  /** Banded, floored presentation of `score`. Never 100, never below 40. */
  matchPercent: number
  /** One line, e.g. `Matches 4 of 5 requirements`. */
  headline: string
  /** Prose. Templated offline; rephrased by the LLM when configured. */
  summary: string
  criteria: CriterionOutcome[]
  components: ScoreComponent[]
}

/**
 * A page of ranked results plus the true match count.
 *
 * `total` is every product above the relevance floor; `results` is the
 * diversified page. Keeping them separate is what lets the assistant say
 * "found 19, showing the 12 strongest" instead of reporting the page size as
 * the total.
 */
export interface RankedPage {
  results: RankedProduct[]
  total: number
}

export interface RankedProduct {
  product: ProductView
  /** 0..1 raw score. Presentation uses `explanation.matchPercent`. */
  score: number
  explanation: MatchExplanation
}

/* -------------------------------------------------------------------------- */
/* Assistant                                                                  */
/* -------------------------------------------------------------------------- */

export type MessageRole = 'user' | 'assistant'

export interface FollowUpOption {
  /** Canonical value to apply when chosen. */
  value: string
  label: string
  /** How many candidates remain if chosen — shown as a hint. */
  resultCount?: number
}

export interface FollowUpQuestion {
  /** Spec key or pseudo-key (`price`, `application`) the question resolves. */
  field: string
  question: string
  options: FollowUpOption[]
  /** Buyer can decline; we then rank without the constraint. */
  skippable: boolean
}

export interface AssistantMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  intent?: SearchIntent
  results?: RankedProduct[]
  followUp?: FollowUpQuestion | null
  /** Comparison prose when the turn produced a trade-off summary. */
  comparison?: string
  totalMatches?: number
  error?: AssistantError | null
}

export type AssistantErrorKind =
  | 'unparseable'
  | 'no_results'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'network'
  | 'server'

export interface AssistantError {
  kind: AssistantErrorKind
  message: string
  /** What the UI should offer as the recovery action. */
  recovery?: string
}

export interface Conversation {
  id: string
  userId: string | null
  title: string
  messages: AssistantMessage[]
  createdAt: string
  updatedAt: string
}
